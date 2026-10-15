import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Emotion, SupportedLanguage, QuadrantId } from '../types';
import { EMOTIONS, getEmotionColor } from '../data/emotionsData';
import {
  PLANE_CANVAS_SIZE,
  PLANE_ORIGIN,
  QUADRANT_SLOTS,
  QUADRANT_CENTERS,
} from '../data/planeLayout';
import { MoodPlaneBubble } from './MoodPlaneBubble';
import { triggerHaptic } from '../utils/haptics';

interface MoodMeterPlaneProps {
  language: SupportedLanguage;
  selectedEmotions: Emotion[];
  onSelectEmotion: (emotion: Emotion) => void;
  onBack: () => void;
  focusedQuadrant?: QuadrantId | null;
}

export const MoodMeterPlane: React.FC<MoodMeterPlaneProps> = ({
  language,
  selectedEmotions,
  onSelectEmotion,
  onBack,
  focusedQuadrant,
}) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = useRef({ x: 0, y: 0 });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [centerEmotion, setCenterEmotion] = useState<Emotion | null>(null);
  const lastCenterId = useRef<string | null>(null);

  // Pre-flatten all 144 emotions with their slots for fast O(1) distance calculation
  const allPlacedEmotions = React.useMemo(() => {
    const list: { emotion: Emotion; slot: { x: number; y: number; size: number } }[] = [];
    ['high_unpleasant', 'high_pleasant', 'low_unpleasant', 'low_pleasant'].forEach(
      (quadrantId) => {
        const quadEmotions = EMOTIONS.filter((e) => e.quadrant === quadrantId);
        const slots = QUADRANT_SLOTS[quadrantId] || [];
        quadEmotions.forEach((emotion, idx) => {
          const slot = slots[idx];
          if (slot) {
            list.push({ emotion, slot });
          }
        });
      }
    );
    return list;
  }, []);

  const updateCenterEmotion = (curX: number, curY: number) => {
    const screenCenterX = dimensions.width / 2;
    const screenCenterY = dimensions.height / 2;

    const targetCanvasX = screenCenterX - curX;
    const targetCanvasY = screenCenterY - curY;

    let minDistanceSq = Infinity;
    let closest: Emotion | null = null;

    for (let i = 0; i < allPlacedEmotions.length; i++) {
      const item = allPlacedEmotions[i];
      const dx = item.slot.x - targetCanvasX;
      const dy = item.slot.y - targetCanvasY;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closest = item.emotion;
      }
    }

    // If screen center is near the axes intersection (middle of plane), do not select any tile
    const distToOriginSq =
      (targetCanvasX - PLANE_ORIGIN.x) * (targetCanvasX - PLANE_ORIGIN.x) +
      (targetCanvasY - PLANE_ORIGIN.y) * (targetCanvasY - PLANE_ORIGIN.y);

    if (distToOriginSq < 60 * 60 || minDistanceSq > 58 * 58 || !closest) {
      if (lastCenterId.current !== null) {
        lastCenterId.current = null;
        setCenterEmotion(null);
      }
      return;
    }

    if (closest.id !== lastCenterId.current) {
      lastCenterId.current = closest.id;
      setCenterEmotion(closest);
      triggerHaptic('light');
    }
  };

  // Sync panOffset and compute center emotion whenever pan changes
  useEffect(() => {
    const id = pan.addListener((value) => {
      panOffset.current = value;
      updateCenterEmotion(value.x, value.y);
    });
    return () => pan.removeListener(id);
  }, [allPlacedEmotions, dimensions]);

  // Update window dimensions
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => sub?.remove();
  }, []);

  // Center plane to focusedQuadrant or canvas origin on mount / focusedQuadrant change
  useEffect(() => {
    const W = dimensions.width;
    const H = dimensions.height;
    const target =
      focusedQuadrant && QUADRANT_CENTERS[focusedQuadrant]
        ? QUADRANT_CENTERS[focusedQuadrant]
        : PLANE_ORIGIN;
    const initX = W / 2 - target.x;
    const initY = H / 2 - target.y;
    pan.setValue({ x: initX, y: initY });
    panOffset.current = { x: initX, y: initY };
    updateCenterEmotion(initX, initY);
  }, [dimensions, allPlacedEmotions, focusedQuadrant]);

  const clampToBounds = () => {
    const W = dimensions.width;
    const H = dimensions.height;
    const padding = 220;

    const minX = W - PLANE_CANVAS_SIZE - padding;
    const maxX = padding;
    const minY = H - PLANE_CANVAS_SIZE - padding;
    const maxY = padding;

    let targetX = panOffset.current.x;
    let targetY = panOffset.current.y;
    let clamped = false;

    if (targetX < minX) {
      targetX = minX;
      clamped = true;
    }
    if (targetX > maxX) {
      targetX = maxX;
      clamped = true;
    }
    if (targetY < minY) {
      targetY = minY;
      clamped = true;
    }
    if (targetY > maxY) {
      targetY = maxY;
      clamped = true;
    }

    if (clamped) {
      Animated.spring(pan, {
        toValue: { x: targetX, y: targetY },
        useNativeDriver: false,
        friction: 8,
        tension: 45,
      }).start();
    }
  };

  const jumpToQuadrant = (quadId: QuadrantId) => {
    triggerHaptic('medium');
    const W = dimensions.width;
    const H = dimensions.height;
    const target = QUADRANT_CENTERS[quadId] || PLANE_ORIGIN;
    const targetX = W / 2 - target.x;
    const targetY = H / 2 - target.y;
    Animated.spring(pan, {
      toValue: { x: targetX, y: targetY },
      useNativeDriver: false,
      friction: 7,
      tension: 40,
    }).start();
  };

  const recenter = () => {
    triggerHaptic('light');
    const W = dimensions.width;
    const H = dimensions.height;
    // Always move to the middle of the whole plane (0,0 origin: 660, 660) with no selection
    const target = PLANE_ORIGIN;
    const initX = W / 2 - target.x;
    const initY = H / 2 - target.y;
    lastCenterId.current = null;
    setCenterEmotion(null);
    Animated.spring(pan, {
      toValue: { x: initX, y: initY },
      useNativeDriver: false,
      friction: 8,
      tension: 45,
    }).start();
  };

  // Full arbitrary 2D PanResponder (works with mouse drag and finger gestures in all directions)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: panOffset.current.x,
          y: panOffset.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        clampToBounds();
      },
    })
  ).current;

  // Support mouse wheel and trackpad two-finger scroll on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleWheel = (e: any) => {
      // Allow 2D panning via wheel / trackpad
      const newX = panOffset.current.x - (e.deltaX || 0);
      const newY = panOffset.current.y - (e.deltaY || 0);
      pan.setValue({ x: newX, y: newY });
      clampToBounds();
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [dimensions]);

  const selectedIds = new Set(selectedEmotions.map((e) => e.id));

  // Search filter
  const searchResults = searchQuery.trim()
    ? EMOTIONS.filter((e) => {
        const q = searchQuery.toLowerCase().trim();
        const ruMatch = e.ru.name.toLowerCase().includes(q);
        const enMatch = e.en.name.toLowerCase().includes(q);
        return ruMatch || enMatch;
      }).slice(0, 10)
    : [];

  return (
    <View style={styles.container}>
      {/* 2D Infinite Pan View */}
      <View style={styles.panViewport} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.canvas,
            {
              transform: pan.getTranslateTransform(),
            },
          ]}
        >
          {/* Subtle Coordinate Axis Lines at (PLANE_ORIGIN.x, PLANE_ORIGIN.y) */}
          <View
            style={[
              styles.axisLineH,
              { top: PLANE_ORIGIN.y, width: PLANE_CANVAS_SIZE },
            ]}
          />
          <View
            style={[
              styles.axisLineV,
              { left: PLANE_ORIGIN.x, height: PLANE_CANVAS_SIZE },
            ]}
          />

          {/* Subtle Origin Point */}
          <View
            style={[
              styles.originDot,
              {
                left: PLANE_ORIGIN.x - 7,
                top: PLANE_ORIGIN.y - 7,
              },
            ]}
          />

          {/* Render all 144 emotion tiles (36 per quadrant in 6x6 grid) */}
          {['high_unpleasant', 'high_pleasant', 'low_unpleasant', 'low_pleasant'].map(
            (quadrantId) => {
              const quadEmotions = EMOTIONS.filter((e) => e.quadrant === quadrantId);
              const slots = QUADRANT_SLOTS[quadrantId] || [];

              return quadEmotions.map((emotion, idx) => {
                const slot = slots[idx];
                if (!slot) return null;

                return (
                  <MoodPlaneBubble
                    key={emotion.id}
                    emotion={emotion}
                    isSelected={selectedIds.has(emotion.id)}
                    isCenterFocused={centerEmotion?.id === emotion.id}
                    language={language}
                    size={slot.size}
                    x={slot.x}
                    y={slot.y}
                    onPress={onSelectEmotion}
                  />
                );
              });
            }
          )}
        </Animated.View>
      </View>

      {/* Floating Top Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('light');
            onBack();
          }}
          style={styles.circularButton}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Selected count pill */}
        {selectedEmotions.length > 0 && (
          <View style={styles.selectedCountPill}>
            <Text style={styles.selectedCountText}>
              {language === 'ru'
                ? `Выбрано: ${selectedEmotions.length}/3`
                : `Selected: ${selectedEmotions.length}/3`}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => {
            triggerHaptic('light');
            setIsSearchOpen(!isSearchOpen);
          }}
          style={styles.circularButton}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isSearchOpen ? 'close' : 'search'}
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* Floating Center Focused Emotion Card */}
      {centerEmotion && !isSearchOpen && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onSelectEmotion(centerEmotion)}
          style={styles.floatingCenterCard}
        >
          <View
            style={[
              styles.floatingCenterDot,
              {
                backgroundColor: getEmotionColor(
                  centerEmotion.quadrant,
                  centerEmotion.intensity
                ),
              },
            ]}
          />
          <View style={styles.floatingCenterContent}>
            <View style={styles.floatingCenterTitleRow}>
              <Text style={styles.floatingCenterTitle}>
                {language === 'ru' ? centerEmotion.ru.name : centerEmotion.en.name}
              </Text>
              <Text style={styles.floatingCenterAction}>
                {language === 'ru' ? 'Выбрать →' : 'Select →'}
              </Text>
            </View>
            <Text style={styles.floatingCenterDef} numberOfLines={1}>
              {language === 'ru'
                ? centerEmotion.ru.definition
                : centerEmotion.en.definition}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Floating Quadrants Quick-Jump & Recenter (Top-Right under header) */}
      {!isSearchOpen && (
        <View style={styles.floatingControlsGroup}>
          <View style={styles.quadrantJumpPill}>
            <TouchableOpacity
              onPress={() => jumpToQuadrant('high_unpleasant')}
              style={[styles.quadrantDotBtn, { backgroundColor: '#FB7185' }]}
              activeOpacity={0.7}
            />
            <TouchableOpacity
              onPress={() => jumpToQuadrant('high_pleasant')}
              style={[styles.quadrantDotBtn, { backgroundColor: '#FBBF24' }]}
              activeOpacity={0.7}
            />
            <TouchableOpacity
              onPress={() => jumpToQuadrant('low_unpleasant')}
              style={[styles.quadrantDotBtn, { backgroundColor: '#38BDF8' }]}
              activeOpacity={0.7}
            />
            <TouchableOpacity
              onPress={() => jumpToQuadrant('low_pleasant')}
              style={[styles.quadrantDotBtn, { backgroundColor: '#4ADE80' }]}
              activeOpacity={0.7}
            />
          </View>

          <TouchableOpacity
            onPress={recenter}
            style={styles.recenterButton}
            activeOpacity={0.8}
          >
            <Ionicons name="locate-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Search Input Bar Overlay */}
      {isSearchOpen && (
        <View style={styles.searchOverlay}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#A0AEC0" />
            <TextInput
              style={styles.searchInput}
              placeholder={
                language === 'ru'
                  ? 'Поиск среди 144 чувств...'
                  : 'Search among 144 feelings...'
              }
              placeholderTextColor="#718096"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#A0AEC0" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick search dropdown results */}
          {searchResults.length > 0 && (
            <View style={styles.searchResultsDropdown}>
              {searchResults.map((e) => {
                const name = language === 'ru' ? e.ru.name : e.en.name;
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.searchResultItem}
                    onPress={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                      onSelectEmotion(e);
                    }}
                  >
                    <View
                      style={[
                        styles.resultColorDot,
                        {
                          backgroundColor:
                            e.quadrant === 'high_unpleasant'
                              ? '#FB7185'
                              : e.quadrant === 'high_pleasant'
                              ? '#FBBF24'
                              : e.quadrant === 'low_unpleasant'
                              ? '#38BDF8'
                              : '#4ADE80',
                        },
                      ]}
                    />
                    <Text style={styles.searchResultText}>{name}</Text>
                    <Ionicons name="add" size={18} color="#A0AEC0" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  panViewport: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  canvas: {
    width: PLANE_CANVAS_SIZE,
    height: PLANE_CANVAS_SIZE,
    backgroundColor: '#000000',
    position: 'relative',
  },
  axisLineH: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  axisLineV: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  originDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderColor: '#000000',
  },
  topHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 24,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  circularButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 30, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  selectedCountPill: {
    backgroundColor: 'rgba(30, 30, 32, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  selectedCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  searchOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 80,
    left: 16,
    right: 16,
    zIndex: 120,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 10,
  },
  searchResultsDropdown: {
    backgroundColor: '#16191F',
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2D3748',
    maxHeight: 260,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#202530',
  },
  resultColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  searchResultText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  floatingControlsGroup: {
    position: 'absolute',
    top: 76,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 95,
  },
  quadrantJumpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 26, 34, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  quadrantDotBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  recenterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E252E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingCenterCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(22, 26, 34, 0.94)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 90,
  },
  floatingCenterDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  floatingCenterContent: {
    flex: 1,
  },
  floatingCenterTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  floatingCenterTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  floatingCenterAction: {
    color: '#4FD1C5',
    fontSize: 13,
    fontWeight: '700',
  },
  floatingCenterDef: {
    color: '#CBD5E0',
    fontSize: 12,
    lineHeight: 16,
  },
});
