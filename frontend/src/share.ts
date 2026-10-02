import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";

/** Télécharge le PDF puis ouvre la feuille de partage native (ou un nouvel onglet sur le web). */
export async function sharePdf(url: string, fileName: string) {
  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }
  const safe = fileName.replace(/[^\p{L}\p{N} _-]/gu, "_").trim() || "retroplanning";
  const target = `${FileSystem.cacheDirectory}${safe}.pdf`;
  const res = await FileSystem.downloadAsync(url, target);
  if (res.status !== 200) throw new Error("Le PDF n'a pas pu être généré");
  if (!(await Sharing.isAvailableAsync())) throw new Error("Le partage n'est pas disponible sur cet appareil");
  await Sharing.shareAsync(res.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Partager le rétroplanning" });
}
