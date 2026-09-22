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
} from 'react-native';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'REGISTERED' | 'ERROR';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'TX' | 'RX' | 'SYS' | 'ERR';
  text: string;
}

export default function App() {
  const [serverUrl, setServerUrl] = useState('ws://100.119.137.60:4000/ws/body');
  const [psk, setPsk] = useState('xcycy79QMbeWsYATXJOJCGbrd6cjSyDjb9RkLbqjfXE');
  const [bodyId, setBodyId] = useState('iphone-mobile-v1');
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  const addLog = (type: LogEntry['type'], text: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
    setLogs((prev) => [...prev.slice(-150), { id, timestamp: time, type, text }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

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
      // React Native supports options as 3rd parameter with custom headers
      const ws = new (WebSocket as any)(url, [], {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('SYS', 'WebSocket connection established (OPEN)');
        setStatus('CONNECTED');

        // Send CapabilityAdvertisement r?ng theo BodyProtocol
        const advertiseMsg = {
          type: 'body.advertise',
          advertisement: {
            bodyId: bodyId.trim(),
            bodyType: 'mobile',
            name: 'iPhone Mobile Body',
            capabilities: [],
          },
        };
        const payloadStr = JSON.stringify(advertiseMsg);
        ws.send(payloadStr);
        addLog('TX', `body.advertise -> ${payloadStr}`);

        // Start 10s heartbeat
        startHeartbeat(ws);
      };

      ws.onmessage = (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : '<binary data>';
          addLog('RX', raw);

          const parsed = JSON.parse(event.data);
          if (parsed.type === 'body.advertise_ack') {
            if (parsed.status === 'REGISTERED') {
              setStatus('REGISTERED');
              addLog('SYS', `*** Brain verified body: REGISTERED (id: ${parsed.bodyId}) ***`);
            } else {
              addLog('ERR', `Registration rejected: ${parsed.status || 'UNKNOWN'}`);
              setStatus('ERROR');
            }
          } else if (parsed.type === 'body.heartbeat_ack') {
            // Heartbeat ACK
          }
        } catch (e: any) {
          addLog('RX', `Raw data: ${event.data}`);
        }
      };

      ws.onerror = (e: any) => {
        addLog('ERR', `WebSocket Error: ${e.message || 'Connection failed'}`);
        setStatus('ERROR');
      };

      ws.onclose = (e: any) => {
        stopHeartbeat();
        setStatus('DISCONNECTED');
        addLog('SYS', `WebSocket disconnected (code: ${e.code}, reason: ${e.reason || 'normal close'})`);
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
    addLog('SYS', 'Disconnected by user');
  };

  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'REGISTERED':
        return '#10B981'; // Green
      case 'CONNECTED':
        return '#3B82F6'; // Blue
      case 'CONNECTING':
        return '#F59E0B'; // Amber
      case 'ERROR':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray
    }
  };

  const isConnected = status === 'CONNECTED' || status === 'REGISTERED' || status === 'CONNECTING';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>BOW Body Mobile</Text>
          <View style={[styles.badge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.badgeText}>{status}</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Server WebSocket URL:</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="ws://100.119.137.60:4000/ws/body"
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
            secureTextEntry={false}
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
              styles.actionButton,
              { backgroundColor: isConnected ? '#DC2626' : '#2563EB' },
            ]}
            onPress={handleConnect}
          >
            <Text style={styles.actionButtonText}>
              {isConnected ? 'Disconnect' : 'Connect & Advertise'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logHeaderRow}>
          <Text style={styles.logHeaderTitle}>Network Logs (Spike Bý?c 0)</Text>
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
            <Text style={styles.emptyLogText}>No network logs yet. Tap 'Connect & Advertise' to test.</Text>
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
    backgroundColor: '#0F172A',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  formContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1,
    borderColor: '#334155',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    marginTop: 14,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  logHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  logHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#334155',
    borderRadius: 4,
  },
  clearBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#020617',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  logContent: {
    padding: 10,
  },
  emptyLogText: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  logTime: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 6,
    marginTop: 2,
  },
  logTag: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 6,
    marginTop: 2,
  },
  tagTX: {
    color: '#38BDF8',
  },
  tagRX: {
    color: '#4ADE80',
  },
  tagSYS: {
    color: '#A78BFA',
  },
  tagERR: {
    color: '#F87171',
  },
  logText: {
    flex: 1,
    fontSize: 11,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
