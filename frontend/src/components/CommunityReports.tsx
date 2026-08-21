import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import type { CommunityReport } from "../types";
import { colors } from "../theme";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru";
  if (mins < 60) return `${mins} m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} j`;
  return `${Math.floor(hrs / 24)} h`;
}

export function CommunityReports({ reports, copy }: { reports: CommunityReport[]; copy: Copy }) {
  const sorted = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (
    <View style={styles.wrap} testID="community-reports">
      <View style={styles.head}>
        <MaterialCommunityIcons name="account-group-outline" size={16} color={colors.inkSoft} />
        <Text style={styles.headText}>{copy.communityReports}</Text>
        <Text style={styles.count}>{sorted.length}</Text>
      </View>
      {sorted.length === 0 ? (
        <Text style={styles.empty}>{copy.noCommunityReports}</Text>
      ) : (
        sorted.map((report, index) => {
          const isScam = report.kind === "scam";
          const color = isScam ? colors.brand : colors.success;
          const icon = isScam ? "alert-octagon" : "check-circle";
          return (
            <View key={`${report.reporter_id}-${index}`} style={styles.item} testID={`community-report-${index}`}>
              <View style={[styles.icon, { backgroundColor: `${color}18` }]}>
                <MaterialCommunityIcons name={icon} size={15} color={color} />
              </View>
              <View style={styles.body}>
                <View style={styles.row}>
                  <Text style={styles.name}>{report.reporter_name}</Text>
                  <Text style={styles.time}>{timeAgo(report.created_at)}</Text>
                </View>
                <Text style={[styles.kind, { color }]}>{isScam ? copy.reportScam : copy.reportReal}</Text>
                {report.reason ? <Text style={styles.detail}>{report.reason}</Text> : null}
                {report.note ? <Text style={styles.detail}>{report.note}</Text> : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  headText: { color: colors.ink, fontSize: 13, fontWeight: "700", flex: 1 },
  count: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", backgroundColor: colors.surfaceContainer, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  empty: { color: colors.inkSoft, fontSize: 12, fontStyle: "italic", paddingVertical: 4 },
  item: { flexDirection: "row", gap: 9, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 1 },
  body: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  time: { color: colors.outline, fontSize: 10, fontWeight: "600" },
  kind: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  detail: { color: colors.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
