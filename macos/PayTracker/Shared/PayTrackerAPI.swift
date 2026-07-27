import Foundation

struct PayTrackerAPI: Sendable {
    var baseURL: URL
    var sessionToken: String?

    init(
        baseURL: URL = SessionStore.baseURL,
        sessionToken: String? = SessionStore.sessionToken
    ) {
        self.baseURL = baseURL
        self.sessionToken = sessionToken
    }

    func fetchOverview(dateRangeType: String = "month") async throws -> OverviewStatsDTO {
        try await get(
            path: "/api/stats/overview",
            query: ["dateRangeType": dateRangeType],
            authenticated: true
        )
    }

    func fetchMe() async throws -> AppUserDTO {
        let response: MeResponseDTO = try await get(
            path: "/api/auth/me",
            authenticated: true
        )
        return response.user
    }

    func fetchCategories(type: TransactionTypeDTO? = nil) async throws -> [CategoryDTO] {
        var query: [String: String] = [:]
        if let type {
            query["type"] = type.rawValue
        }
        let response: CategoriesResponseDTO = try await get(
            path: "/api/categories",
            query: query,
            authenticated: true
        )
        return response.categories
    }

    func createTransaction(_ body: CreateTransactionRequestDTO) async throws {
        try await postDiscardingBody(
            path: "/api/transactions",
            body: body,
            authenticated: true,
            extraHeaders: ["idempotency-key": body.idempotencyKey]
        )
    }

    func redeemLoginTransfer(code: String, locale: String = "en") async throws -> String {
        let response: RedeemLoginTransferResponseDTO = try await post(
            path: "/api/auth/login-transfer/redeem",
            body: ["code": code, "locale": locale],
            authenticated: false
        )
        return response.token
    }

    func approvalStatus(token: String) async throws -> String {
        let response: ApprovalStatusResponseDTO = try await get(
            path: "/api/auth/qr-approval/status",
            query: ["token": token],
            authenticated: false
        )
        return response.status
    }

    func redeemApproval(token: String) async throws -> String {
        let (data, response) = try await rawRequest(
            method: "POST",
            path: "/api/auth/qr-approval/redeem",
            query: nil,
            body: ["token": token] as [String: String],
            authenticated: false,
            extraHeaders: nil
        )
        try ensureSuccess(response, data: data)
        if let authToken = response.value(forHTTPHeaderField: "set-auth-token"),
           !authToken.isEmpty {
            return authToken
        }
        let decoded = try JSONDecoder().decode(RedeemApprovalResponseDTO.self, from: data)
        guard let sessionToken = decoded.token, !sessionToken.isEmpty else {
            throw PayTrackerAPIError.httpStatus(response.statusCode, "Missing session token")
        }
        return sessionToken
    }

    func signInEmail(email: String, password: String) async throws -> String {
        let (data, response) = try await rawRequest(
            method: "POST",
            path: "/api/auth/sign-in/email",
            query: nil,
            body: SignInEmailRequestDTO(email: email, password: password),
            authenticated: false,
            extraHeaders: nil
        )
        try ensureSuccess(response, data: data)
        if let authToken = response.value(forHTTPHeaderField: "set-auth-token"),
           !authToken.isEmpty {
            return authToken
        }
        throw PayTrackerAPIError.httpStatus(response.statusCode, "Missing set-auth-token header")
    }

    private func get<T: Decodable>(
        path: String,
        query: [String: String] = [:],
        authenticated: Bool
    ) async throws -> T {
        let (data, response) = try await rawRequest(
            method: "GET",
            path: path,
            query: query,
            body: Optional<[String: String]>.none,
            authenticated: authenticated,
            extraHeaders: nil
        )
        try ensureSuccess(response, data: data)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw PayTrackerAPIError.decoding(error)
        }
    }

    private func post<Body: Encodable, T: Decodable>(
        path: String,
        body: Body,
        authenticated: Bool,
        extraHeaders: [String: String]? = nil
    ) async throws -> T {
        let (data, response) = try await rawRequest(
            method: "POST",
            path: path,
            query: nil,
            body: body,
            authenticated: authenticated,
            extraHeaders: extraHeaders
        )
        try ensureSuccess(response, data: data)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw PayTrackerAPIError.decoding(error)
        }
    }

    private func postDiscardingBody<Body: Encodable>(
        path: String,
        body: Body,
        authenticated: Bool,
        extraHeaders: [String: String]? = nil
    ) async throws {
        let (data, response) = try await rawRequest(
            method: "POST",
            path: path,
            query: nil,
            body: body,
            authenticated: authenticated,
            extraHeaders: extraHeaders
        )
        try ensureSuccess(response, data: data)
    }

    private func rawRequest<Body: Encodable>(
        method: String,
        path: String,
        query: [String: String]?,
        body: Body?,
        authenticated: Bool,
        extraHeaders: [String: String]?
    ) async throws -> (Data, HTTPURLResponse) {
        if authenticated, sessionToken == nil {
            throw PayTrackerAPIError.notLinked
        }

        guard var components = URLComponents(
            url: baseURL,
            resolvingAgainstBaseURL: false
        ) else {
            throw PayTrackerAPIError.httpStatus(400, "Invalid base URL")
        }
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let apiPath = path.hasPrefix("/") ? path : "/\(path)"
        components.path = basePath.isEmpty ? apiPath : "/\(basePath)\(apiPath)"
        if let query, !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else {
            throw PayTrackerAPIError.httpStatus(400, "Invalid URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let extraHeaders {
            for (key, value) in extraHeaders {
                request.setValue(value, forHTTPHeaderField: key)
            }
        }
        if let token = sessionToken, authenticated {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            do {
                request.httpBody = try JSONEncoder().encode(body)
            } catch {
                throw PayTrackerAPIError.decoding(error)
            }
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw PayTrackerAPIError.httpStatus(0, "Invalid response")
            }
            return (data, http)
        } catch let error as PayTrackerAPIError {
            throw error
        } catch {
            throw PayTrackerAPIError.transport(error)
        }
    }

    private func ensureSuccess(_ response: HTTPURLResponse, data: Data) throws {
        guard (200..<300).contains(response.statusCode) else {
            let message = (try? JSONDecoder().decode(APIErrorBodyDTO.self, from: data))
                .flatMap { $0.error?.message ?? $0.message }
                ?? String(data: data, encoding: .utf8)
                ?? "Request failed"
            throw PayTrackerAPIError.httpStatus(response.statusCode, message)
        }
    }
}
