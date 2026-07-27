import SwiftUI

struct LinkAccountView: View {
    let onLinked: () -> Void

    @State private var mode: Mode = .code
    @State private var code = ""
    @State private var email = ""
    @State private var password = ""
    @State private var statusMessage = "Enter the 6-digit code from Devices on the web app."
    @State private var isBusy = false
    @State private var pollTask: Task<Void, Never>?

    private enum Mode {
        case code
        case email
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Link Pay Tracker")
                .font(.largeTitle.weight(.semibold))
            Text("Connect to \(SessionStore.baseURL.absoluteString)")
                .foregroundStyle(.secondary)

            Picker("Method", selection: $mode) {
                Text("Device code").tag(Mode.code)
                Text("Email").tag(Mode.email)
            }
            .pickerStyle(.segmented)

            Group {
                if mode == .code {
                    TextField("123456", text: $code)
                        .textFieldStyle(.roundedBorder)
                        .font(.title2.monospacedDigit())
                    Button(isBusy ? "Waiting…" : "Link with code") {
                        Task { await linkWithCode() }
                    }
                    .disabled(isBusy || normalizedCode.count != 6)
                    .buttonStyle(.borderedProminent)
                } else {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                    Button(isBusy ? "Signing in…" : "Sign in") {
                        Task { await signInWithEmail() }
                    }
                    .disabled(isBusy || email.isEmpty || password.isEmpty)
                    .buttonStyle(.borderedProminent)
                }
            }
            .glassEffect(in: .rect(cornerRadius: 16))
            .padding(4)

            Text(statusMessage)
                .font(.callout)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .padding(24)
        .onDisappear {
            pollTask?.cancel()
        }
    }

    private var normalizedCode: String {
        code.filter(\.isNumber)
    }

    private func linkWithCode() async {
        isBusy = true
        statusMessage = "Requesting approval…"
        pollTask?.cancel()
        do {
            let api = PayTrackerAPI(sessionToken: nil)
            let approvalToken = try await api.redeemLoginTransfer(code: normalizedCode)
            statusMessage = "Approve this Mac on your phone or another logged-in device…"
            pollTask = Task {
                await pollApproval(token: approvalToken)
            }
        } catch {
            isBusy = false
            statusMessage = error.localizedDescription
        }
    }

    private func pollApproval(token: String) async {
        let api = PayTrackerAPI(sessionToken: nil)
        for _ in 0..<90 {
            if Task.isCancelled { return }
            do {
                let status = try await api.approvalStatus(token: token)
                if status == "approved" {
                    let sessionToken = try await api.redeemApproval(token: token)
                    SessionStore.sessionToken = sessionToken
                    statusMessage = "Linked."
                    isBusy = false
                    onLinked()
                    return
                }
                if status == "declined" || status == "expired" || status == "consumed" {
                    statusMessage = "Approval \(status). Try again with a fresh code."
                    isBusy = false
                    return
                }
            } catch {
                statusMessage = error.localizedDescription
                isBusy = false
                return
            }
            try? await Task.sleep(for: .seconds(2))
        }
        statusMessage = "Timed out waiting for approval."
        isBusy = false
    }

    private func signInWithEmail() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let api = PayTrackerAPI(sessionToken: nil)
            let token = try await api.signInEmail(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            SessionStore.sessionToken = token
            statusMessage = "Linked."
            onLinked()
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}
