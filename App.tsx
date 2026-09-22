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
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'REGISTERED' | 'ERROR';
type VoiceStage = 'IDLE' | 'RECORDING' | 'THINKING' | 'SPEAKING';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'TX' | 'RX' | 'SYS' | 'ERR';
  text: string;
}

export default function App() {
  const [serverUrl, setServerUrl] = useState(
    process.env.EXPO_PUBLIC_BRAIN_URL || 'ws://100.122.26.119:4000/ws/body'
  );
  const [psk, setPsk] = useState(
    process.env.EXPO_PUBLIC_BODY_PSK || 'xcycy79QMbeWsYATXJOJCGbrd6cjSyDjb9RkLbqjfXE'
  );
  const [bodyId, setBodyId] = useState('iphone-mobile-v1');
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [voiceStage, setVoiceStage] = useState<VoiceStage>('IDLE');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [brainResponse, setBrainResponse] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView | null>(null);

  const addLog = (type: LogEntry['type'], text: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
    setLogs((prev) => [...prev.slice(-150), { id, timestamp: time, type, text }]);
  };

  const clearLogs = () => setLogs([]);

  // Setup Audio Mode on mount
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (err: any) {
        addLog('ERR', `Audio setup error: ${err.message}`);
      }
    })();

    return () => {
      stopHeartbeat();
      if (wsRef.current) wsRef.current.close();
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
    };
  }, []);

  // Pulsing animation for PTT button
  useEffect(() => {
    if (voiceStage === 'RECORDING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 400,
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
        addLog('TX', `Heartbeat sent (bodyId: ${bodyId.trim()})`);
      }
    }, 10000);
  };

  // Play incoming Base64 WAV audio through iPhone speaker
  const playAudioBase64 = async (base64Data: string, onDone?: () => void) => {
    try {
      setVoiceStage('SPEAKING');
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }

      const tempFileUri = `${FileSystem.cacheDirectory}incoming_voice_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(tempFileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: tempFileUri },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
          setVoiceStage('IDLE');
          sound.unloadAsync().catch(() => {});
          FileSystem.deleteAsync(tempFileUri, { idempotent: true }).catch(() => {});
          if (onDone) onDone();
        }
      });

      addLog('SYS', '?? Ðang phát audio gi?ng Duy Oryx ra loa iPhone...');
    } catch (err: any) {
      addLog('ERR', `Playback error: ${err.message || String(err)}`);
      setVoiceStage('IDLE');
      if (onDone) onDone();
    }
  };

  const handleConnect = () => {
    if (status === 'CONNECTING' || status === 'CONNECTED' || status === 'REGISTERED') {
      disconnect();
      return;
    }

    let url = serverUrl.trim();
    const token = psk.trim();
    if (!url) {
      addLog('ERR', 'Server URL cannot be empty');
      return;
    }

    if (token) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}token=${encodeURIComponent(token)}`;
    }

    addLog('SYS', `Connecting to ${serverUrl.trim()}...`);
    setStatus('CONNECTING');

    try {
      const ws = new (WebSocket as any)(url, [], {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('SYS', 'WebSocket connection established (OPEN)');
        setStatus('CONNECTED');

        // Dynamic Capabilities: Advertise Audio capabilities
        const advertiseMsg = {
          type: 'body.advertise',
          advertisement: {
            bodyId: bodyId.trim(),
            bodyType: 'mobile',
            name: 'iPhone 14 Pro Mobile Body',
            capabilities: [
              {
                name: 'audio.play',
                description: 'Phát âm thanh t?ng h?p WAV ra loa ngoài iPhone',
                riskLevel: 'low',
                parameters: {
                  type: 'object',
                  properties: {
                    audioBase64: { type: 'string', description: 'Base64 encoded audio' },
                    format: { type: 'string', description: 'wav or mp3' },
                  },
                  required: ['audioBase64'],
                },
              },
              {
                name: 'audio.capture',
                description: 'Thu âm microphone t? iPhone',
                riskLevel: 'medium',
                parameters: {
                  type: 'object',
                  properties: {
                    durationMs: { type: 'number', description: 'Th?i lý?ng thu âm (ms)' },
                  },
                },
              },
              {
                name: 'audio.status',
                description: 'Ki?m tra tr?ng thái driver âm thanh iPhone',
                riskLevel: 'low',
              },
            ],
          },
        };
        const payloadStr = JSON.stringify(advertiseMsg);
        ws.send(payloadStr);
        addLog('TX', `body.advertise -> (3 Audio Capabilities advertised)`);

        startHeartbeat(ws);
      };

      ws.onmessage = async (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : '<binary data>';
          const parsed = JSON.parse(event.data);

          if (parsed.type === 'body.advertise_ack') {
            if (parsed.status === 'REGISTERED') {
              setStatus('REGISTERED');
              addLog('SYS', `? Brain BodyRegistry: REGISTERED (id: ${parsed.bodyId})`);
            } else {
              addLog('ERR', `Registration rejected: ${parsed.status || 'UNKNOWN'}`);
              setStatus('ERROR');
            }
          } else if (parsed.type === 'body.command') {
            // Brain sends command to iPhone (e.g. audio.play)
            const cmd = parsed.command;
            addLog('RX', `[COMMAND] ${cmd.capability} (id: ${cmd.commandId})`);

            if (cmd.capability === 'audio.play') {
              const audioBase64 = cmd.params?.audioBase64 || cmd.parameters?.audioBase64;
              if (audioBase64) {
                const tStart = Date.now();
                await playAudioBase64(audioBase64, () => {
                  const execDurationMs = Date.now() - tStart;
                  const resMsg = {
                    type: 'body.command_result',
                    result: {
                      commandId: cmd.commandId,
                      bodyId: bodyId.trim(),
                      success: true,
                      executionDurationMs: execDurationMs,
                      data: { played: true },
                    },
                  };
                  ws.send(JSON.stringify(resMsg));
                  addLog('TX', `body.command_result (success, ${execDurationMs}ms)`);
                });
              }
            } else if (cmd.capability === 'audio.status') {
              const resMsg = {
                type: 'body.command_result',
                result: {
                  commandId: cmd.commandId,
                  bodyId: bodyId.trim(),
                  success: true,
                  executionDurationMs: 5,
                  data: {
                    status: 'HEALTHY',
                    device: 'iPhone Microphone / Speaker',
                    platform: Platform.OS,
                  },
                },
              };
              ws.send(JSON.stringify(resMsg));
              addLog('TX', `body.command_result -> audio.status (HEALTHY)`);
            }
          } else if (parsed.type === 'voice.audition_result') {
            // Direct Audition Result from Piper TTS
            addLog('RX', `[AUDITION] Piper TTS Duy Oryx received (${parsed.latencyMs}ms)`);
            setBrainResponse(parsed.text || 'Audition sample');
            setLatencyMs(parsed.latencyMs);
            if (parsed.audioBase64) {
              await playAudioBase64(parsed.audioBase64);
            }
          } else if (parsed.type === 'voice.roundtrip_result') {
            // Full E2E Voice Roundtrip Result
            setVoiceStage('IDLE');
            setUserTranscript(parsed.userText || '');
            setBrainResponse(parsed.responseText || '');
            setLatencyMs(parsed.totalDurationMs || null);
            addLog('RX', `[ROUNDTRIP] User: "${parsed.userText}" -> Brain: "${parsed.responseText}" (${parsed.totalDurationMs}ms)`);
            if (parsed.audioPlayback || parsed.audioBase64) {
              // If audio base64 is in payload, play it
              if (parsed.audioBase64) {
                await playAudioBase64(parsed.audioBase64);
              }
            }
          } else if (parsed.type === 'body.heartbeat_ack') {
            // Heartbeat OK
          } else {
            addLog('RX', raw.length > 100 ? raw.slice(0, 100) + '...' : raw);
          }
        } catch (e: any) {
          addLog('RX', `Raw: ${String(event.data).slice(0, 80)}`);
        }
      };

      ws.onerror = (e: any) => {
        addLog('ERR', `WebSocket Error: ${e.message || 'Connection failed'}`);
        setStatus('ERROR');
        setVoiceStage('IDLE');
      };

      ws.onclose = (e: any) => {
        stopHeartbeat();
        setStatus('DISCONNECTED');
        setVoiceStage('IDLE');
        addLog('SYS', `WebSocket closed (code: ${e.code}, reason: ${e.reason || 'normal'})`);
        wsRef.current = null;
      };
    } catch (err: any) {
      addLog('ERR', `Connect exception: ${err.message || String(err)}`);
      setStatus('ERROR');
    }
  };

  const disconnect = () => {
    stopHeartbeat();
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setStatus('DISCONNECTED');
    setVoiceStage('IDLE');
    addLog('SYS', 'Disconnected by user');
  };

  // Push-to-Talk: Start Recording (Press In)
  const startRecording = async () => {
    if (status !== 'REGISTERED') {
      Alert.alert('Chýa k?t n?i Brain', 'Vui l?ng nh?n "Connect" trý?c khi s? d?ng PTT.');
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('C?n c?p quy?n Micro', 'Vui l?ng cho phép quy?n truy c?p Microphone trong Cài ð?t iPhone.');
        return;
      }

      setVoiceStage('RECORDING');
      addLog('SYS', '??? PTT B?T Ð?U: Ðang thu âm microphone...');

      // High Quality 16kHz WAV Preset for STT
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      await recording.startAsync();
      recordingRef.current = recording;
    } catch (err: any) {
      addLog('ERR', `L?i b?t ð?u thu âm: ${err.message || String(err)}`);
      setVoiceStage('IDLE');
    }
  };

  // Push-to-Talk: Stop Recording & Send to Brain (Press Out)
  const stopRecordingAndSend = async () => {
    if (voiceStage !== 'RECORDING') return;

    try {
      setVoiceStage('THINKING');
      addLog('SYS', '? PTT K?T THÚC: Ðang g?i audio t?i Brain (Whisper -> Piper)...');

      if (!recordingRef.current) return;
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        addLog('ERR', 'Recording URI r?ng');
        setVoiceStage('IDLE');
        return;
      }

      // Read audio file to Base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Cleanup local temp recording file
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const roundtripPayload = {
          type: 'voice.roundtrip',
          bodyId: bodyId.trim(),
          audioBase64: base64Audio,
          format: 'wav',
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(roundtripPayload));
        addLog('TX', `voice.roundtrip -> (Sent Base64 WAV to Brain)`);
      } else {
        addLog('ERR', 'WebSocket không m? khi g?i audio');
        setVoiceStage('IDLE');
      }
    } catch (err: any) {
      addLog('ERR', `L?i x? l? audio PTT: ${err.message || String(err)}`);
      setVoiceStage('IDLE');
    }
  };

  // Audition Duy Oryx Voice Sample directly from Brain
  const handleAuditionDuyOryx = () => {
    if (status !== 'REGISTERED' || !wsRef.current) {
      Alert.alert('Chýa k?t n?i', 'Vui l?ng k?t n?i v?i Brain trý?c khi audition.');
      return;
    }

    setVoiceStage('THINKING');
    addLog('SYS', '? Ðang yêu c?u Brain t?ng h?p m?u gi?ng Duy Oryx...');
    const auditionMsg = {
      type: 'voice.audition',
      text: 'Chào b?n, tôi là Bow! Gi?ng nói Duy Oryx ðang phát tr?c ti?p trên iPhone qua Tailscale.',
    };
    wsRef.current.send(JSON.stringify(auditionMsg));
    addLog('TX', `voice.audition -> "${auditionMsg.text}"`);
  };

  const getStageTitle = () => {
    switch (voiceStage) {
      case 'RECORDING':
        return 'ÐANG THU ÂM (GI? Ð? NÓI)...';
      case 'THINKING':
        return 'BRAIN ÐANG X? L? (STT / LLM / TTS)...';
      case 'SPEAKING':
        return 'DUY ORYX ÐANG TR? L?I (LOA IPHONE)...';
      default:
        return status === 'REGISTERED' ? 'S?N SÀNG — GI? NÚT Ð? NÓI' : 'CHÝA K?T N?I V?I BRAIN';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'REGISTERED':
        return '#10B981';
      case 'CONNECTED':
        return '#3B82F6';
      case 'CONNECTING':
        return '#F59E0B';
      case 'ERROR':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const isConnected = status === 'CONNECTED' || status === 'REGISTERED' || status === 'CONNECTING';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>BOW TACTICAL BODY</Text>
            <Text style={styles.headerSubtitle}>Tailscale Voice Mesh v4.0</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.badge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.badgeText}>{status}</Text>
            </View>
            <TouchableOpacity
              style={styles.gearButton}
              onPress={() => setShowConfig(!showConfig)}
            >
              <Text style={styles.gearText}>{showConfig ? '?' : '?'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Connection Configuration */}
        {showConfig && (
          <View style={styles.configContainer}>
            <Text style={styles.label}>Brain WebSocket URL:</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="ws://100.122.26.119:4000/ws/body"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isConnected}
            />

            <Text style={styles.label}>Pre-Shared Key (PSK):</Text>
            <TextInput
              style={styles.input}
              value={psk}
              onChangeText={setPsk}
              placeholder="PSK Token"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isConnected}
            />

            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>Body ID:</Text>
                <TextInput
                  style={styles.input}
                  value={bodyId}
                  onChangeText={setBodyId}
                  placeholder="iphone-mobile-v1"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isConnected}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.connectBtn,
                { backgroundColor: isConnected ? '#DC2626' : '#2563EB' },
              ]}
              onPress={handleConnect}
            >
              <Text style={styles.connectBtnText}>
                {isConnected ? 'Disconnect' : 'Connect & Register Capabilities'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Tactical Walkie-Talkie Stage */}
        <View style={styles.stageContainer}>
          {/* Status & Latency Banner */}
          <View style={styles.stageBanner}>
            <View style={[styles.statusDot, { backgroundColor: voiceStage === 'RECORDING' ? '#EF4444' : voiceStage === 'SPEAKING' ? '#10B981' : '#38BDF8' }]} />
            <Text style={styles.stageTitleText}>{getStageTitle()}</Text>
            {latencyMs !== null && (
              <Text style={styles.latencyText}>{latencyMs}ms</Text>
            )}
          </View>

          {/* Transcript / Conversation Display */}
          <View style={styles.transcriptCard}>
            <View style={styles.dialogItem}>
              <Text style={styles.dialogLabelUser}>B?N:</Text>
              <Text style={styles.dialogTextUser}>
                {userTranscript || (voiceStage === 'RECORDING' ? 'Ðang l?ng nghe...' : '—')}
              </Text>
            </View>

            <View style={styles.dialogDivider} />

            <View style={styles.dialogItem}>
              <Text style={styles.dialogLabelBrain}>BOW (DUY ORYX):</Text>
              <Text style={styles.dialogTextBrain}>
                {brainResponse || (voiceStage === 'THINKING' ? 'Ðang suy ngh? câu tr? l?i...' : '—')}
              </Text>
            </View>
          </View>

          {/* Big Push-To-Talk Button */}
          <View style={styles.pttContainer}>
            <Animated.View
              style={[
                styles.pttPulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: voiceStage === 'RECORDING' ? 0.7 : 0.15,
                  borderColor: voiceStage === 'RECORDING' ? '#EF4444' : '#0EA5E9',
                },
              ]}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.pttButton,
                {
                  backgroundColor:
                    voiceStage === 'RECORDING'
                      ? '#DC2626'
                      : voiceStage === 'SPEAKING'
                      ? '#059669'
                      : voiceStage === 'THINKING'
                      ? '#D97706'
                      : status === 'REGISTERED'
                      ? '#0284C7'
                      : '#334155',
                },
              ]}
              onPressIn={startRecording}
              onPressOut={stopRecordingAndSend}
              disabled={status !== 'REGISTERED'}
            >
              <Text style={styles.pttIcon}>???</Text>
              <Text style={styles.pttButtonText}>
                {voiceStage === 'RECORDING'
                  ? 'TH? Ð? G?I'
                  : voiceStage === 'THINKING'
                  ? 'ÐANG NGH?...'
                  : voiceStage === 'SPEAKING'
                  ? 'ÐANG NÓI...'
                  : 'GI? Ð? NÓI'}
              </Text>
              <Text style={styles.pttHint}>Push-to-Talk (PTT)</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Audition Button */}
          <View style={styles.auditionRow}>
            <TouchableOpacity
              style={[
                styles.auditionBtn,
                { opacity: status === 'REGISTERED' ? 1.0 : 0.4 },
              ]}
              onPress={handleAuditionDuyOryx}
              disabled={status !== 'REGISTERED' || voiceStage !== 'IDLE'}
            >
              <Text style={styles.auditionBtnText}>
                ? Audition Gi?ng Duy Oryx (Piper TTS)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Network Raw Logs */}
        <View style={styles.logHeaderRow}>
          <Text style={styles.logHeaderTitle}>Network Logs & Capability Events</Text>
          <TouchableOpacity onPress={clearLogs} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.logContainer}
          contentContainerStyle={styles.logContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {logs.length === 0 ? (
            <Text style={styles.emptyLogText}>Chýa có log. B?m Connect và gi? PTT ð? b?t ð?u.</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logEntry}>
                <Text style={styles.logTime}>{log.timestamp}</Text>
                <Text
                  style={[
                    styles.logTag,
                    log.type === 'TX' && styles.tagTX,
                    log.type === 'RX' && styles.tagRX,
                    log.type === 'SYS' && styles.tagSYS,
                    log.type === 'ERR' && styles.tagERR,
                  ]}
                >
                  [{log.type}]
                </Text>
                <Text style={styles.logText}>{log.text}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  gearButton: {
    padding: 6,
    backgroundColor: '#1F2937',
    borderRadius: 6,
  },
  gearText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  configContainer: {
    padding: 14,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#0B0F19',
    color: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1,
    borderColor: '#334155',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  connectBtn: {
    marginTop: 10,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stageContainer: {
    padding: 14,
    alignItems: 'center',
  },
  stageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  stageTitleText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  latencyText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  transcriptCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 16,
  },
  dialogItem: {
    marginVertical: 2,
  },
  dialogLabelUser: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    marginBottom: 2,
  },
  dialogTextUser: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  dialogDivider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginVertical: 8,
  },
  dialogLabelBrain: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4ADE80',
    marginBottom: 2,
  },
  dialogTextBrain: {
    fontSize: 13,
    color: '#F8FAFC',
    lineHeight: 18,
  },
  pttContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  pttPulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 3,
  },
  pttButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  pttIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  pttButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pttHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  auditionRow: {
    width: '100%',
    marginTop: 12,
  },
  auditionBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  auditionBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  logHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  logHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  clearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#1F2937',
    borderRadius: 4,
  },
  clearBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#050811',
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  logContent: {
    padding: 8,
  },
  emptyLogText: {
    color: '#475569',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  logTime: {
    fontSize: 9,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 4,
    marginTop: 1,
  },
  logTag: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 4,
    marginTop: 1,
  },
  tagTX: { color: '#38BDF8' },
  tagRX: { color: '#4ADE80' },
  tagSYS: { color: '#A78BFA' },
  tagERR: { color: '#F87171' },
  logText: {
    flex: 1,
    fontSize: 10,
    color: '#CBD5E1',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
