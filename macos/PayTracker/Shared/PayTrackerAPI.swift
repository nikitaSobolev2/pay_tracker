import Foundation

struct PayTrackerAPI: Sendable {
    var baseURL: URL
    var sessionToken: String?

    /// Shared session with a low connection cap so widget timelines can't open a TLS storm.
    private static let urlSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 12
        configuration.httpMaximumConnectionsPerHost = 2
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }()

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

    func fetchActivityHeatmap() async throws -> ActivityHeatmapDTO {
        try await get(
            path: "/api/stats/activity",
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

    func createQrApproval(locale: String = "en") async throws -> QrApprovalRequestDTO {
        try await post(
            path: "/api/auth/qr-approval",
            body: ["locale": locale],
            authenticated: false
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
        try await extractSessionToken(
            from: try await rawRequest(
                method: "POST",
                path: "/api/auth/qr-approval/redeem",
                query: nil,
                body: ["token": token] as [String: String],
                authenticated: false,
                extraHeaders: nil
            )
        )
    }

    func signIn(identifier: String, password: String) async throws -> String {
        let trimmed = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.contains("@") {
            return try await extractSessionToken(
                from: try await rawRequest(
                    method: "POST",
                    path: "/api/auth/sign-in/email",
                    query: nil,
                    body: SignInEmailRequestDTO(email: trimmed, password: password),
                    authenticated: false,
                    extraHeaders: nil
                )
            )
        }
        return try await extractSessionToken(
            from: try await rawRequest(
                method: "POST",
                path: "/api/auth/sign-in/username",
                query: nil,
                body: SignInUsernameRequestDTO(username: trimmed, password: password),
                authenticated: false,
                extraHeaders: nil
            )
        )
    }

    private var originHeaderValue: String {
        var components = URLComponents()
        components.scheme = baseURL.scheme
        components.host = baseURL.host
        components.port = baseURL.port
        return components.string ?? baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    private func extractSessionToken(from result: (Data, HTTPURLResponse)) throws -> String {
        let (data, response) = result
        try ensureSuccess(response, data: data)
        if let authToken = response.value(forHTTPHeaderField: "set-auth-token"),
           !authToken.isEmpty {
            return authToken
        }
        if let decoded = try? JSONDecoder().decode(RedeemApprovalResponseDTO.self, from: data),
           let sessionToken = decoded.token,
           !sessionToken.isEmpty {
            return sessionToken
        }
        if let cookieToken = sessionTokenFromSetCookie(response) {
            return cookieToken
        }
        throw PayTrackerAPIError.httpStatus(response.statusCode, "Missing session token")
    }

    private func sessionTokenFromSetCookie(_ response: HTTPURLResponse) -> String? {
        let headers = response.allHeaderFields
        var cookieLines: [String] = []
        for (key, value) in headers {
            let name = String(describing: key).lowercased()
            if name == "set-cookie" {
                cookieLines.append(String(describing: value))
            }
        }
        if let single = response.value(forHTTPHeaderField: "Set-Cookie") {
            cookieLines.append(single)
        }
        for line in cookieLines {
            for part in line.split(separator: ",") {
                let trimmed = part.trimmingCharacters(in: .whitespaces)
                let lower = trimmed.lowercased()
                // Match cookie name at the start of the Set-Cookie segment only.
                guard lower.hasPrefix("better-auth.session_token=")
                    || lower.hasPrefix("__secure-better-auth.session_token=")
                else {
                    continue
                }
                let pair = trimmed.split(separator: ";", maxSplits: 1).first ?? Substring()
                if let equals = pair.firstIndex(of: "=") {
                    let value = String(pair[pair.index(after: equals)...])
                    if !value.isEmpty { return value }
                }
            }
        }
        return nil
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
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // Better Auth CSRF rejects requests with a missing Origin (native clients).
        let origin = originHeaderValue
        request.setValue(origin, forHTTPHeaderField: "Origin")
        request.setValue(origin + "/", forHTTPHeaderField: "Referer")
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
            let (data, response) = try await Self.urlSession.data(for: request)
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
