import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import {
  IOSOutputFormat,
  AudioQuality,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  createAudioPlayer,
  useAudioRecorder,
  type AudioPlayer,
  type RecordingOptions,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'IDLE' | 'ERROR';
type VoiceStage = 'IDLE' | 'RECORDING' | 'SENDING' | 'WAITING' | 'PLAYING';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'TX' | 'RX' | 'SYS' | 'ERR';
  text: string;
}

const PTT_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    extension: '.wav',
    outputFormat: 'wav' as any,
    audioEncoder: 'default' as any,
    sampleRate: 16000,
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 256000,
  },
};

export default function App() {
  const [serverUrl, setServerUrl] = useState(
    process.env.EXPO_PUBLIC_BRAIN_URL || 'ws://100.122.26.119:4000/ws/body'
  );
  const [psk, setPsk] = useState(
    process.env.EXPO_PUBLIC_BODY_PSK || 'xcycy79QMbeWsYATXJOJCGbrd6cjSyDjb9RkLbqjfXE'
  );
  const [bodyId, setBodyId] = useState('iphone-mobile-v1');
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [voiceStage, setVoiceStageState] = useState<VoiceStage>('IDLE');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [brainResponse, setBrainResponse] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  const voiceStageRef = useRef<VoiceStage>('IDLE');
  const setVoiceStage = (stage: VoiceStage) => {
    voiceStageRef.current = stage;
    setVoiceStageState(stage);
  };

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const isManualDisconnectRef = useRef<boolean>(false);

  const sessionIdRef = useRef<string>(
    'session_mobile_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  );
  const playerRef = useRef<AudioPlayer | null>(null);
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Expo-audio recorder hook
  const recorder = useAudioRecorder(PTT_RECORDING_OPTIONS);

  const addLog = (type: LogEntry['type'], text: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
    setLogs((prev) => [...prev.slice(-150), { id, timestamp: time, type, text }]);
  };

  const clearLogs = () => setLogs([]);

  // Initialize Audio Session on mount
  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          shouldPlayInBackground: false,
          interruptionMode: 'mixWithOthers',
        });
      } catch (err: any) {
        addLog('ERR', 'Audio mode setup error: ' + (err.message || String(err)));
      }
    })();

    return () => {
      stopHeartbeat();
      stopReconnectTimer();
      clearWaitingTimeout();
      clearMaxRecordingTimer();
      if (wsRef.current) wsRef.current.close();
      if (playerRef.current) {
        try {
          playerRef.current.release();
        } catch {}
      }
    };
  }, []);

  // PTT pulse animation
  useEffect(() => {
    if (voiceStage === 'RECORDING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [voiceStage]);

  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

  const startHeartbeat = (ws: WebSocket) => {
    stopHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const hbMsg = {
          type: 'body.heartbeat',
          bodyId: bodyId.trim(),
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(hbMsg));
        addLog('TX', 'Heartbeat sent (bodyId: ' + bodyId.trim() + ')');
      }
    }, 10000);
  };

  const stopReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const scheduleAutoReconnect = () => {
    if (isManualDisconnectRef.current) return;
    stopReconnectTimer();
    const attempt = reconnectAttemptRef.current;
    // Exponential backoff: min(8 * 2^n, 60)s
    const delaySec = Math.min(8 * Math.pow(2, attempt), 60);
    reconnectAttemptRef.current += 1;
    addLog(
      'SYS',
      'Auto-reconnect attempt #' + reconnectAttemptRef.current + ' scheduled in ' + delaySec + 's...'
    );
    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delaySec * 1000);
  };

  const clearWaitingTimeout = () => {
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
  };

  const clearMaxRecordingTimer = () => {
    if (maxRecordingTimerRef.current) {
      clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = null;
    }
  };

  // Play audio Base64 PCM WAV from Piper TTS through iPhone speaker
  const playAudioBase64 = async (base64Data: string, onDone?: () => void) => {
    try {
      setVoiceStage('PLAYING');
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.release();
        } catch {}
        playerRef.current = null;
      }

      const tempFileUri = (FileSystem.cacheDirectory || '') + 'incoming_voice_' + Date.now() + '.wav';
      await FileSystem.writeAsStringAsync(tempFileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const player = createAudioPlayer({ uri: tempFileUri });
      playerRef.current = player;

      player.addListener('playbackStatusUpdate', (playbackStatus: any) => {
        if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
          setVoiceStage('IDLE');
          try {
            player.release();
          } catch {}
          FileSystem.deleteAsync(tempFileUri, { idempotent: true }).catch(() => {});
          if (onDone) onDone();
        }
      });

      player.play();
      addLog('SYS', 'Playing Duy Oryx audio (22.05kHz WAV) through iPhone speaker...');
    } catch (err: any) {
      addLog('ERR', 'Playback error: ' + (err.message || String(err)));
      setVoiceStage('IDLE');
      if (onDone) onDone();
    }
  };

  const connect = () => {
    let url = serverUrl.trim();
    const token = psk.trim();
    if (!url) {
      addLog('ERR', 'Server URL cannot be empty');
      return;
    }

    if (token) {
      const delimiter = url.includes('?') ? '&' : '?';
      url = url + delimiter + 'token=' + encodeURIComponent(token);
    }

    isManualDisconnectRef.current = false;
    stopReconnectTimer();
    stopHeartbeat();
    clearWaitingTimeout();
    clearMaxRecordingTimer();

    setStatus('CONNECTING');
    setVoiceStage('IDLE');
    addLog('SYS', 'Initiating WebSocket connection to: ' + url.split('?')[0]);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('SYS', 'WebSocket connected. Sending body.advertise handshake...');
        const advertiseMsg = {
          type: 'body.advertise',
          bodyId: bodyId.trim(),
          capabilities: ['screen', 'camera', 'gps', 'speaker', 'mic', 'audio_duyoryx'],
          device: {
            platform: Platform.OS,
            version: Platform.Version,
            client: 'bow-mobile',
            transport: 'tailscale_wireguard',
            audioSupport: {
              sttInput: '16kHz_1ch_16bit_wav',
              ttsOutput: '22.05kHz_1ch_16bit_wav_duyoryx',
            },
          },
        };
        ws.send(JSON.stringify(advertiseMsg));
        addLog('TX', 'body.advertise sent -> waiting for Brain confirmation');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          addLog('RX', 'Received: [' + msg.type + ']');

          if (msg.type === 'body.registered') {
            setStatus('IDLE');
            reconnectAttemptRef.current = 0;
            addLog(
              'SYS',
              'Brain REGISTERED Body successfully! (Body ID: ' +
                msg.bodyId +
                ', Status: ' +
                msg.status +
                ')'
            );
            startHeartbeat(ws);
          } else if (msg.type === 'voice.roundtrip_result') {
            clearWaitingTimeout();
            const totalMs = msg.totalDurationMs || 0;
            setLatencyMs(totalMs);

            if (msg.success) {
              const uText = msg.userText || '(không có giọng nói)';
              const rText = msg.responseText || '(không có phản hồi)';
              setUserTranscript(uText);
              setBrainResponse(rText);

              addLog('RX', 'STT User: "' + uText + '"');
              addLog('RX', 'Brain Response (' + totalMs + 'ms): "' + rText + '"');

              if (msg.speechAudioBase64) {
                playAudioBase64(msg.speechAudioBase64);
              } else {
                setVoiceStage('IDLE');
              }
            } else {
              setVoiceStage('IDLE');
              const errStage = msg.stageAtError || 'UNKNOWN';
              const errDetails = msg.error || 'Voice roundtrip failed at Brain';
              addLog('ERR', 'Voice Roundtrip Failed at [' + errStage + ']: ' + errDetails);
              Alert.alert('Lỗi xử lý Voice', '[' + errStage + ']: ' + errDetails);
            }
          } else if (msg.type === 'system.error' || msg.type === 'error') {
            addLog('ERR', 'Brain error message: ' + (msg.message || JSON.stringify(msg)));
          }
        } catch (e: any) {
          addLog('ERR', 'Malformed JSON received: ' + event.data.substring(0, 100));
        }
      };

      ws.onerror = (e: any) => {
        addLog('ERR', 'WebSocket Error: ' + (e.message || 'Connection failed'));
        setStatus('ERROR');
        setVoiceStage('IDLE');
        clearWaitingTimeout();
      };

      ws.onclose = (e: any) => {
        stopHeartbeat();
        clearWaitingTimeout();
        clearMaxRecordingTimer();
        setStatus('DISCONNECTED');
        setVoiceStage('IDLE');
        addLog(
          'SYS',
          'WebSocket closed (code: ' + e.code + ', reason: ' + (e.reason || 'normal') + ')'
        );
        wsRef.current = null;
        scheduleAutoReconnect();
      };
    } catch (err: any) {
      addLog('ERR', 'Connect exception: ' + (err.message || String(err)));
      setStatus('ERROR');
      scheduleAutoReconnect();
    }
  };

  const handleToggleConnect = () => {
    if (status === 'IDLE' || status === 'CONNECTING') {
      isManualDisconnectRef.current = true;
      stopReconnectTimer();
      stopHeartbeat();
      clearWaitingTimeout();
      clearMaxRecordingTimer();
      if (wsRef.current) {
        wsRef.current.close(1000, 'User disconnected');
        wsRef.current = null;
      }
      setStatus('DISCONNECTED');
      setVoiceStage('IDLE');
      addLog('SYS', 'Disconnected by user');
    } else {
      reconnectAttemptRef.current = 0;
      connect();
    }
  };

  // Push-to-Talk: Start Recording (Press In)
  const startRecording = async () => {
    if (status !== 'IDLE') {
      Alert.alert('Chưa kết nối Brain', 'Vui lòng kết nối Brain trước khi sử dụng PTT.');
      return;
    }
    if (
      voiceStage !== 'IDLE'
    ) {
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== 'granted') {
        addLog('ERR', 'Microphone permission denied by user');
        Alert.alert(
          'Cần quyền Micro',
          'Vui lòng cho phép quyền truy cập Microphone trong Cài đặt iPhone.'
        );
        return;
      }

      setVoiceStage('RECORDING');
      recorder.record();
      addLog('SYS', 'PTT Recording started (16kHz Mono 16-bit PCM WAV)...');

      // 15s Max Limit Timer
      clearMaxRecordingTimer();
      maxRecordingTimerRef.current = setTimeout(() => {
        addLog('SYS', '15s recording limit reached -> Auto-stopping and sending...');
        stopRecording();
      }, 15000);
    } catch (err: any) {
      addLog('ERR', 'Non-network recording error: ' + (err.message || String(err)));
      setVoiceStage('IDLE');
      clearMaxRecordingTimer();
    }
  };

  // Push-to-Talk: Stop Recording & Send to Brain (Press Out)
  const stopRecording = async () => {
    clearMaxRecordingTimer();
    if (voiceStageRef.current !== 'RECORDING') return;

    try {
      setVoiceStage('SENDING');
      await recorder.stop();

      const uri = recorder.uri;
      if (!uri) {
        addLog('ERR', 'No audio recorded URI available');
        setVoiceStage('IDLE');
        return;
      }

      addLog('SYS', 'Reading recorded WAV file: ' + uri);
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!audioBase64 || audioBase64.length === 0) {
        addLog('ERR', 'Recorded audio is empty');
        setVoiceStage('IDLE');
        return;
      }

      addLog(
        'SYS',
        'Audio captured (' +
          Math.round((audioBase64.length * 3) / 4 / 1024) +
          ' KB). Uploading to Brain...'
      );

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        addLog('ERR', 'WebSocket is disconnected while trying to send audio');
        setVoiceStage('IDLE');
        return;
      }

      const reqId = 'req_voice_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const corrId = 'corr_voice_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

      const payload = {
        type: 'voice.roundtrip',
        requestId: reqId,
        correlationId: corrId,
        bodyId: bodyId.trim(),
        sessionId: sessionIdRef.current,
        userId: 'boss_user',
        role: 'owner',
        isOwner: true,
        audioBase64: audioBase64,
      };

      wsRef.current.send(JSON.stringify(payload));
      setVoiceStage('WAITING');
      addLog('TX', 'voice.roundtrip sent (STT -> Brain Core -> TTS Duy Oryx 22.05kHz)...');

      // 20s Waiting timeout fallback
      clearWaitingTimeout();
      waitingTimeoutRef.current = setTimeout(() => {
        if (voiceStageRef.current === 'WAITING') {
          addLog('ERR', 'Voice roundtrip timed out (20s) waiting for Brain response');
          setVoiceStage('IDLE');
          Alert.alert('Hết thời gian chờ', 'Brain không phản hồi yêu cầu Voice trong 20 giây.');
        }
      }, 20000);
    } catch (err: any) {
      addLog('ERR', 'Stop recording / upload error: ' + (err.message || String(err)));
      setVoiceStage('IDLE');
    }
  };

  // Audition Voice Test Button (Tests TTS audio pipeline directly)
  const handleAuditionTest = () => {
    if (status !== 'IDLE') {
      Alert.alert('Chưa kết nối Brain', 'Vui lòng kết nối Brain trước khi thử giọng nói Duy Oryx.');
      return;
    }
    if (voiceStageRef.current !== 'IDLE') {
      return;
    }

    try {
      setVoiceStage('SENDING');
      const reqId = 'req_audition_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const corrId = 'corr_audition_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

      const payload = {
        type: 'voice.roundtrip',
        requestId: reqId,
        correlationId: corrId,
        bodyId: bodyId.trim(),
        sessionId: sessionIdRef.current,
        userId: 'boss_user',
        role: 'owner',
        isOwner: true,
        simulatedTranscript:
          'Chào Brain, tôi là Mobile Body iPhone 14 Pro, đang kiểm tra giọng nói Duy Oryx qua PTT.',
        audioBase64: '',
      };

      wsRef.current?.send(JSON.stringify(payload));
      setVoiceStage('WAITING');
      addLog('TX', 'Sent Audition Test payload to Brain (Duy Oryx TTS probe)...');

      clearWaitingTimeout();
      waitingTimeoutRef.current = setTimeout(() => {
        if (voiceStageRef.current === 'WAITING') {
          addLog('ERR', 'Audition test timed out (20s)');
          setVoiceStage('IDLE');
        }
      }, 20000);
    } catch (err: any) {
      addLog('ERR', 'Audition test error: ' + (err.message || String(err)));
      setVoiceStage('IDLE');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'IDLE':
        return '#10B981';
      case 'CONNECTING':
        return '#F59E0B';
      case 'ERROR':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const getStageColor = () => {
    switch (voiceStage) {
      case 'RECORDING':
        return '#EF4444';
      case 'SENDING':
        return '#3B82F6';
      case 'WAITING':
        return '#F59E0B';
      case 'PLAYING':
        return '#8B5CF6';
      default:
        return '#10B981';
    }
  };

  const getStageLabel = () => {
    switch (voiceStage) {
      case 'RECORDING':
        return '🔴 ĐANG THU ÂM (PTT ACTIVE)';
      case 'SENDING':
        return '⬆️ ĐANG TẢI LÊN BRAIN...';
      case 'WAITING':
        return '🧠 BRAIN ĐANG XỬ LÝ & TỔNG HỢP...';
      case 'PLAYING':
        return '🔊 DUY ORYX ĐANG NÓI (22.05kHz)...';
      default:
        return status === 'IDLE' ? '🟢 SẴN SÀNG ĐÀM THOẠI (GIỮ ĐỂ NÓI)' : '⚪ CHỜ KẾT NỐI';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F17" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>BOW MOBILE BODY</Text>
            <Text style={styles.headerSubtitle}>iPhone Walkie-Talkie • Duy Oryx Local TTS</Text>
          </View>
          <TouchableOpacity
            style={styles.configToggleBtn}
            onPress={() => setShowConfig(!showConfig)}
          >
            <Text style={styles.configToggleText}>{showConfig ? 'Đóng' : 'Cấu hình'}</Text>
          </TouchableOpacity>
        </View>

        {/* STATUS BAR */}
        <View style={styles.statusBarCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {status === 'IDLE'
                ? 'ĐÃ KẾT NỐI & SẴN SÀNG (REGISTERED)'
                : status === 'CONNECTING'
                ? 'ĐANG KẾT NỐI BRAIN...'
                : status === 'ERROR'
                ? 'LỖI KẾT NỐI'
                : 'ĐÃ NGẮT KẾT NỐI'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.connectBtn,
              { backgroundColor: status === 'IDLE' ? '#1E293B' : '#2563EB' },
            ]}
            onPress={handleToggleConnect}
          >
            <Text style={styles.connectBtnText}>
              {status === 'IDLE' || status === 'CONNECTING' ? 'Ngắt kết nối' : 'Kết nối Brain'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CONFIG ACCORDION */}
        {showConfig && (
          <View style={styles.configCard}>
            <Text style={styles.configLabel}>Brain WebSocket URL (Tailscale WireGuard):</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="ws://100.122.26.119:4000/ws/body"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.configLabel}>Body Pre-Shared Key (PSK):</Text>
            <TextInput
              style={styles.input}
              value={psk}
              onChangeText={setPsk}
              placeholder="PSK Secret"
              placeholderTextColor="#64748B"
              secureTextEntry
            />
            <Text style={styles.configLabel}>Body ID:</Text>
            <TextInput
              style={styles.input}
              value={bodyId}
              onChangeText={setBodyId}
              placeholder="iphone-mobile-v1"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* VOICE STAGE INDICATOR */}
        <View style={[styles.stageBanner, { borderColor: getStageColor() }]}>
          <Text style={[styles.stageText, { color: getStageColor() }]}>{getStageLabel()}</Text>
          {latencyMs !== null && voiceStage === 'IDLE' && (
            <Text style={styles.latencyText}>Độ trễ phản hồi: {latencyMs}ms</Text>
          )}
        </View>

        {/* PTT BUTTON SECTION */}
        <View style={styles.pttSection}>
          <Animated.View
            style={[
              styles.pttButtonOuter,
              {
                transform: [{ scale: pulseAnim }],
                borderColor: voiceStage === 'RECORDING' ? '#EF4444' : '#334155',
                backgroundColor:
                  voiceStage === 'RECORDING' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.pttButtonInner,
                {
                  backgroundColor:
                    voiceStage === 'RECORDING'
                      ? '#DC2626'
                      : status === 'IDLE'
                      ? '#2563EB'
                      : '#334155',
                },
              ]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={status !== 'IDLE'}
            >
              <Text style={styles.pttButtonIcon}>
                {voiceStage === 'RECORDING' ? '🎙️' : voiceStage === 'PLAYING' ? '🔊' : '🎤'}
              </Text>
              <Text style={styles.pttButtonLabel}>
                {voiceStage === 'RECORDING' ? 'NHẢ ĐỂ GỬI' : 'GIỮ ĐỂ NÓI'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.auditionBtn}
            onPress={handleAuditionTest}
            disabled={status !== 'IDLE' || voiceStage !== 'IDLE'}
          >
            <Text style={styles.auditionBtnText}>🔊 Thử giọng Duy Oryx (Audition Test)</Text>
          </TouchableOpacity>
        </View>

        {/* TRANSCRIPT & RESPONSE CARD */}
        {(userTranscript !== '' || brainResponse !== '') && (
          <View style={styles.transcriptCard}>
            {userTranscript !== '' && (
              <View style={styles.dialogueRow}>
                <Text style={styles.dialogueSpeaker}>Bạn (STT 16kHz):</Text>
                <Text style={styles.dialogueUserText}>{userTranscript}</Text>
              </View>
            )}
            {brainResponse !== '' && (
              <View style={[styles.dialogueRow, { marginTop: 8 }]}>
                <Text style={styles.dialogueSpeakerBrain}>Brain Duy Oryx:</Text>
                <Text style={styles.dialogueBrainText}>{brainResponse}</Text>
              </View>
            )}
          </View>
        )}

        {/* NETWORK & SYSTEM LOG CONSOLE */}
        <View style={styles.logContainer}>
          <View style={styles.logHeader}>
            <Text style={styles.logTitle}>LOG GIAO THỨC & ÂM THANH</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={styles.clearLogText}>Xoá log</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={scrollViewRef}
            style={styles.logScroll}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {logs.length === 0 ? (
              <Text style={styles.emptyLogText}>Chưa có log sự kiện nào.</Text>
            ) : (
              logs.map((log) => (
                <View key={log.id} style={styles.logLine}>
                  <Text style={styles.logTime}>{log.timestamp}</Text>
                  <Text
                    style={[
                      styles.logBadge,
                      log.type === 'TX'
                        ? styles.logTx
                        : log.type === 'RX'
                        ? styles.logRx
                        : log.type === 'ERR'
                        ? styles.logErr
                        : styles.logSys,
                    ]}
                  >
                    {log.type}
                  </Text>
                  <Text style={styles.logContent}>{log.text}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  configToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  configToggleText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBarCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  connectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  configCard: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  configLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#030712',
    color: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  stageBanner: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  latencyText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  pttSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  pttButtonOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttButtonInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pttButtonIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  pttButtonLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  auditionBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  auditionBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  transcriptCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  dialogueRow: {
    flexDirection: 'column',
  },
  dialogueSpeaker: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
    marginBottom: 2,
  },
  dialogueUserText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  dialogueSpeakerBrain: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA',
    marginBottom: 2,
  },
  dialogueBrainText: {
    fontSize: 13,
    color: '#F8FAFC',
    lineHeight: 18,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#030712',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    minHeight: 160,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  logTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  clearLogText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  logScroll: {
    flex: 1,
  },
  emptyLogText: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  logLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  logTime: {
    color: '#475569',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 6,
    marginTop: 1,
  },
  logBadge: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
    overflow: 'hidden',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logTx: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60A5FA',
  },
  logRx: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#34D399',
  },
  logSys: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    color: '#94A3B8',
  },
  logErr: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#F87171',
  },
  logContent: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 15,
  },
});
