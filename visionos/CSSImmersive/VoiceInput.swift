// CSSOS_WAVE_1060 — 真·hands-free 语音(SFSpeechRecognizer + AVAudioEngine)。
//   说出"想听的作品名"或"创作咒语"→ 实时听写 transcript, 终判 onFinal 回调。
//   需在 Info.plist 加: NSSpeechRecognitionUsageDescription + NSMicrophoneUsageDescription。
//   语言按系统区域选 zh-CN / en-US(可后续做多语)。

import Foundation
import Speech
import AVFoundation

@MainActor
final class VoiceInput: ObservableObject {
    @Published var transcript = ""
    @Published var isListening = false
    @Published var denied = false

    private let engine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    /// 终判(用户停顿/点停)回调, 收到完整一句。
    var onFinal: ((String) -> Void)?

    init() {
        let zh = Locale.current.identifier.lowercased().hasPrefix("zh")
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: zh ? "zh-CN" : "en-US"))
            ?? SFSpeechRecognizer()
    }

    func toggle() { isListening ? stop() : start() }

    func start() {
        guard !isListening else { return }
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                guard let self = self else { return }
                guard status == .authorized else { self.denied = true; return }
                self.begin()
            }
        }
    }

    private func begin() {
        guard let recognizer = recognizer, recognizer.isAvailable else { return }
        do {
            let s = AVAudioSession.sharedInstance()
            try s.setCategory(.record, mode: .measurement, options: .duckOthers)
            try s.setActive(true, options: .notifyOthersOnDeactivation)
        } catch { return }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        request = req

        let input = engine.inputNode
        let fmt = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buf, _ in
            self?.request?.append(buf)
        }
        engine.prepare()
        do { try engine.start() } catch { return }

        transcript = ""
        isListening = true
        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            Task { @MainActor in
                guard let self = self else { return }
                if let r = result {
                    self.transcript = r.bestTranscription.formattedString
                    if r.isFinal { self.stop() }
                }
                if error != nil { self.stop() }
            }
        }
    }

    func stop() {
        guard isListening else { return }
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil; task = nil
        isListening = false
        let t = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty { onFinal?(t) }
    }
}
