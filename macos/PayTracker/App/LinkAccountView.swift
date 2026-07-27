import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI

struct LinkAccountView: View {
    let onLinked: () -> Void

    @State private var mode: Mode = .qr
    @State private var code = ""
    @State private var email = ""
    @State private var password = ""
    @State private var statusMessage = "Scan this QR with a logged-in phone."
    @State private var isBusy = false
    @State private var pollTask: Task<Void, Never>?
    @State private var approvalURL: URL?
    @State private var qrImage: NSImage?

    private enum Mode: String, CaseIterable {
        case qr
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
                Text("QR code").tag(Mode.qr)
                Text("Device code").tag(Mode.code)
                Text("Password").tag(Mode.email)
            }
            .pickerStyle(.segmented)
            .onChange(of: mode) { _, newMode in
                pollTask?.cancel()
                isBusy = false
                switch newMode {
                case .qr:
                    statusMessage = "Scan this QR with a logged-in phone."
                    Task { await startQrLogin() }
                case .code:
                    approvalURL = nil
                    qrImage = nil
                    statusMessage = "Enter the 6-digit code from Devices on the web app."
                case .email:
                    approvalURL = nil
                    qrImage = nil
                    statusMessage = "Sign in with email or username."
                }
            }

            Group {
                switch mode {
                case .qr:
                    qrSection
                case .code:
                    codeSection
                case .email:
                    passwordSection
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
        .task {
            if mode == .qr {
                await startQrLogin()
            }
        }
        .onDisappear {
            pollTask?.cancel()
        }
    }

    private var qrSection: some View {
        VStack(spacing: 12) {
            if let qrImage {
                Image(nsImage: qrImage)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 220, height: 220)
                    .padding(12)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
            } else if isBusy {
                ProgressView("Creating QR…")
                    .frame(width: 220, height: 220)
            } else {
                ContentUnavailableView(
                    "No QR yet",
                    systemImage: "qrcode",
                    description: Text("Tap refresh to create a new login QR.")
                )
                .frame(height: 220)
            }

            if let approvalURL {
                Text(approvalURL.absoluteString)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .textSelection(.enabled)
            }

            HStack {
                Button("Refresh QR") {
                    Task { await startQrLogin() }
                }
                .disabled(isBusy)
                if isBusy {
                    ProgressView()
                        .controlSize(.small)
                    Text("Waiting for approval…")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(12)
    }

    private var codeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("123456", text: $code)
                .textFieldStyle(.roundedBorder)
                .font(.title2.monospacedDigit())
            Button(isBusy ? "Waiting…" : "Link with code") {
                Task { await linkWithCode() }
            }
            .disabled(isBusy || normalizedCode.count != 6)
            .buttonStyle(.borderedProminent)
        }
        .padding(12)
    }

    private var passwordSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Email or username", text: $email)
                .textFieldStyle(.roundedBorder)
            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)
            Button(isBusy ? "Signing in…" : "Sign in") {
                Task { await signInWithPassword() }
            }
            .disabled(isBusy || email.isEmpty || password.isEmpty)
            .buttonStyle(.borderedProminent)
        }
        .padding(12)
    }

    private var normalizedCode: String {
        code.filter(\.isNumber)
    }

    private func startQrLogin() async {
        pollTask?.cancel()
        isBusy = true
        statusMessage = "Creating QR…"
        approvalURL = nil
        qrImage = nil
        do {
            let api = PayTrackerAPI(sessionToken: nil)
            let approval = try await api.createQrApproval()
            guard let url = URL(string: approval.approvalUrl) else {
                throw PayTrackerAPIError.httpStatus(500, "Invalid approval URL")
            }
            approvalURL = url
            qrImage = Self.makeQRCodeImage(from: approval.approvalUrl)
            statusMessage = "Scan with a logged-in phone, then approve this Mac."
            pollTask = Task {
                await pollApproval(token: approval.token)
            }
        } catch {
            isBusy = false
            statusMessage = error.localizedDescription
        }
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
                    statusMessage = "Approval \(status). Refresh QR or try again."
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
        statusMessage = "Timed out waiting for approval. Refresh QR."
        isBusy = false
    }

    private func signInWithPassword() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let api = PayTrackerAPI(sessionToken: nil)
            let token = try await api.signIn(identifier: email, password: password)
            SessionStore.sessionToken = token
            statusMessage = "Linked."
            onLinked()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private static func makeQRCodeImage(from string: String) -> NSImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        let rep = NSCIImageRep(ciImage: scaled)
        let image = NSImage(size: rep.size)
        image.addRepresentation(rep)
        return image
    }
}
