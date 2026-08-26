import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// App-wide crash net. React Navigation screens live inside a single native
// tree — a render-time throw in ANY screen (undefined property access, a bad
// .map() over null, a missing param, etc.) unwinds all the way up and crashes
// the whole app with no recovery except a full restart. This catches that,
// shows a recoverable "Something went wrong" screen instead, and lets the
// user retry without losing their session (auth state lives in the store,
// untouched by this boundary resetting).
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught a crash:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={s.root}>
          <ScrollView contentContainerStyle={s.scroll}>
            <Text style={s.icon}>⚠️</Text>
            <Text style={s.title}>Something went wrong</Text>
            <Text style={s.sub}>
              An unexpected error occurred. You can try again — your session is still intact.
            </Text>
            {__DEV__ && (
              <Text style={s.debug}>{this.state.error.message}</Text>
            )}
            <TouchableOpacity style={s.btn} onPress={this.reset} activeOpacity={0.85}>
              <Text style={s.btnTxt}>Try Again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F5F3FF' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon:   { fontSize: 48, marginBottom: 12 },
  title:  { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  sub:    { fontSize: 14, color: '#7B7B8A', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  debug:  { fontSize: 12, color: '#EF4444', textAlign: 'center', marginBottom: 20, fontFamily: 'monospace' },
  btn:    { backgroundColor: '#7C4DFF', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  btnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
