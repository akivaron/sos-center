import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, shadow, zIndex } from "../theme";
import type { Incident } from "../types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type OsmPlace = {
  displayName: string;
  latitude: number;
  longitude: number;
};

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function SuggestionRow({ label, sublabel, active, onPress, testID }: {
  label: string;
  sublabel?: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.suggestion, active && styles.suggestionActive, pressed && styles.pressed]}
      testID={testID}
    >
      <MaterialCommunityIcons
        name={sublabel ? "alert-box-outline" : "map-marker-outline"}
        size={16}
        color={active ? "#FFFFFF" : colors.inkSoft}
      />
      <View style={styles.suggestionBody}>
        <Text style={[styles.suggestionLabel, active && styles.suggestionLabelActive]} numberOfLines={1}>{label}</Text>
        {sublabel ? <Text style={[styles.suggestionSub, active && styles.suggestionLabelActive]} numberOfLines={1}>{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}

export function OsmAreaAutocomplete({ value, onChangeText, onSelect, placeholder, testPrefix }: {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (place: OsmPlace) => void;
  placeholder: string;
  testPrefix: string;
}) {
  const [results, setResults] = useState<OsmPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const query = useDebounced(value.trim(), 400);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);
    fetch(`${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`, {
      signal: controller.signal,
      headers: { "Accept-Language": "id", "User-Agent": "ResQMap/1.0 (sos-center donation campaigns)" },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((rows: { display_name: string; lat: string; lon: string }[]) => {
        setResults(rows.map((row) => ({
          displayName: row.display_name,
          latitude: parseFloat(row.lat),
          longitude: parseFloat(row.lon),
        })));
        setOpen(true);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setResults([]);
        setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  const pick = (place: OsmPlace) => {
    onChangeText(place.displayName.split(",")[0]);
    onSelect(place);
    setOpen(false);
    setResults([]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            setOpen(false);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSoft}
          style={[styles.input, styles.grow]}
          testID={`${testPrefix}-input`}
        />
        {loading ? <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} /> : null}
      </View>
      {open && results.length > 0 ? (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
            {results.map((place, index) => (
              <SuggestionRow
                key={`${place.latitude},${place.longitude}`}
                label={place.displayName}
                active={false}
                onPress={() => pick(place)}
                testID={`${testPrefix}-option-${index}`}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {error && !open ? (
        <Text style={styles.hintText}>OpenStreetMap tidak dapat dihubungi.</Text>
      ) : null}
    </View>
  );
}

export function IncidentAutocomplete({ selectedId, incidents, onSelect, placeholder, testPrefix }: {
  selectedId: string;
  incidents: Incident[];
  onSelect: (incident: Incident | null) => void;
  placeholder: string;
  testPrefix: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? incidents.filter((incident) =>
        `${incident.description} ${incident.incident_type}`.toLowerCase().includes(needle)).slice(0, 5)
    : incidents.slice(0, 5);
  const selected = incidents.find((incident) => incident.id === selectedId);

  return (
    <View style={styles.wrap}>
      <TextInput
        value={open ? query : selected ? (selected.description || selected.incident_type) : query}
        onChangeText={(text) => {
          setQuery(text);
          setOpen(true);
          if (selected) onSelect(null);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          if (selected) onSelect(null);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        style={styles.input}
        testID={`${testPrefix}-input`}
      />
      {open ? (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
            {matches.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada hasil.</Text>
            ) : matches.map((incident) => (
              <SuggestionRow
                key={incident.id}
                label={incident.description || incident.incident_type}
                sublabel={incident.incident_type}
                active={incident.id === selectedId}
                onPress={() => {
                  onSelect(incident);
                  setQuery("");
                  setOpen(false);
                }}
                testID={`${testPrefix}-option-${incident.id}`}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", zIndex: zIndex.toast },
  inputRow: { flexDirection: "row", alignItems: "center" },
  grow: { flex: 1 },
  input: { minHeight: 48, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 14, color: colors.ink, fontSize: 15, ...shadow },
  spinner: { marginLeft: 8 },
  dropdown: { position: "absolute", left: 0, right: 0, top: 52, backgroundColor: colors.surface, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.border, ...shadow },
  dropdownScroll: { maxHeight: 220 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  suggestionActive: { backgroundColor: colors.primary },
  suggestionBody: { flex: 1 },
  suggestionLabel: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  suggestionSub: { color: colors.inkSoft, fontSize: 11, marginTop: 1 },
  suggestionLabelActive: { color: "#FFFFFF" },
  emptyText: { color: colors.inkSoft, fontSize: 13, padding: 12 },
  hintText: { color: colors.inkSoft, fontSize: 12, marginTop: 6 },
  pressed: { opacity: 0.7 },
});
