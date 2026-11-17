import type { LucideIcon } from 'lucide-react-native';
import { useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, ScrollView, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { StripeCorner } from './StripeCorner';
import { Text } from './ui';

type Props = {
  /** The sheet's heading; or `header`, for a heading row with more in it. */
  title?: string;
  header?: ReactNode;
  children?: ReactNode;
  /** Fixed at the foot of the sheet, so they stay above the keyboard: the main action first. */
  actions?: ReactNode;
  /** False when the body is a list that scrolls itself (Search foods). */
  scroll?: boolean;
  /** Drag the handle or heading down to close (the header's calendar). */
  dragToClose?: boolean;
  onClose(): void;
};

// The frame of every sheet with a text field. A sheet is drawn edge to edge, and Android doesn't
// resize such a window for the keyboard, so the sheet is lifted above the keyboard here: the body
// scrolls to the field being typed in and the actions stay fixed under it. Their padding clears the
// navigation bar; with the keyboard up the bar is behind it, so the offset takes that padding back.
// The redesign's frame (D-35, with 2.2): a card-coloured sheet with a grab handle, the stripe corner
// at its top right, and its title in condensed capitals.
export function Sheet({ title, header, children, actions, scroll = true, dragToClose = false, onClose }: Props) {
  const styles = useStyles();
  const [dy] = useState(() => new Animated.Value(0));
  const scrollY = useRef(0);
  const touch = useRef<{ x: number; y: number; at: number; dragging: boolean } | null>(null);
  // Drag down to close, with the touch system's own handlers (as the Workout in progress pill does): a
  // clear downward drag while the body is scrolled to its top moves the sheet; let go past 100, or in a
  // quick flick, and it slides off and closes, else it springs back.
  function touchStart(e: GestureResponderEvent) {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, at: Date.now(), dragging: false };
  }
  function touchMove(e: GestureResponderEvent) {
    const start = touch.current;
    if (!start) return;
    const moveY = e.nativeEvent.pageY - start.y;
    const moveX = e.nativeEvent.pageX - start.x;
    if (!start.dragging) {
      if (scrollY.current > 0 || moveY <= 8 || moveY <= Math.abs(moveX) * 1.5) return;
      start.dragging = true;
    }
    dy.setValue(Math.max(0, moveY));
  }
  function touchEnd(e: GestureResponderEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start?.dragging) return;
    const moved = e.nativeEvent.pageY - start.y;
    const speed = moved / Math.max(1, Date.now() - start.at);
    if (moved > 100 || speed > 0.8) {
      Animated.timing(dy, { toValue: 800, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => onClose());
    } else {
      Animated.spring(dy, { toValue: 0, bounciness: 0, speed: 18, useNativeDriver: true }).start();
    }
  }
  const dragHandlers = dragToClose ? { onTouchStart: touchStart, onTouchMove: touchMove, onTouchEnd: touchEnd, onTouchCancel: touchEnd } : {};
  // None outside the app (tests).
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-bottom} style={[styles.backdrop, dragToClose && styles.clear]}>
        {/* The dimming fades as the sheet is dragged down, so it hides smoothly with it. */}
        {dragToClose ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.dim, { opacity: dy.interpolate({ inputRange: [0, 400], outputRange: [1, 0], extrapolate: 'clamp' }) }]}
          />
        ) : null}
        <Animated.View style={[styles.sheet, { transform: [{ translateY: dy }] }]} {...dragHandlers}>
          <StripeCorner />
          <View style={styles.handle} />
          <View style={styles.header}>
            {title !== undefined ? (
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            ) : null}
            {header}
          </View>
          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(e) => {
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.list]}>{children}</View>
          )}
          {actions ? <View style={[styles.actions, { paddingBottom: 16 + bottom }]}>{actions}</View> : <View style={{ height: 16 + bottom }} />}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * A sheet's heading with the design's 56 tile over it (D-35): caramel, or red for a deletion. Passed
 * as the sheet's `header`.
 */
export function SheetHeading({
  icon: Icon,
  title,
  danger = false,
  inline = false,
}: {
  icon: LucideIcon;
  title: string;
  danger?: boolean;
  /** The tile beside the title, on one line (the saved meals' sheets, D-69); else over it. */
  inline?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={inline ? styles.headingInline : styles.heading}>
      <View style={[styles.tile, inline && styles.tileInline, danger && styles.dangerTile]}>
        <Icon size={inline ? 24 : 26} color={danger ? colors.danger : colors.accent} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, inline && styles.titleInline]}>
        {title}
      </Text>
    </View>
  );
}

// 16 at the sides, as the tab screens; 12 between the parts of the body, 8 between the actions. The
// main action is filled, Cancel and Close are links.
const useStyles = themedStyles((c) => ({
  clear: { backgroundColor: 'transparent' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
  sheet: {
    maxHeight: '90%',
    overflow: 'hidden',
    backgroundColor: c.surface,
    paddingTop: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18, backgroundColor: c.inkSubtle },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  title: TYPE.sheetTitle,
  heading: { gap: 14 },
  headingInline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 56, height: 56, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  tileInline: { width: 48, height: 48 },
  titleInline: { flex: 1, fontSize: 30, lineHeight: 32 },
  dangerTile: { backgroundColor: c.dangerTint },
  // The body gives way first when the keyboard leaves little room.
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  list: { flexShrink: 1 },
  actions: { paddingHorizontal: 16, paddingTop: 12, gap: 8, backgroundColor: c.surface },
}));
