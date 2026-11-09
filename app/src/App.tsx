import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useGeometry } from "./layout/geometry";
import { MapDataProvider } from "./map/data";
import { AppProvider } from "./state/store";
import { AppShell } from "./shell/AppShell";
import { C } from "./theme";

function Root() {
  const geo = useGeometry();
  return (
    <MapDataProvider>
      <AppProvider geo={geo}>
        <AppShell />
      </AppProvider>
    </MapDataProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  return (
    <SafeAreaProvider style={{ backgroundColor: C.bg0 }}>
      <StatusBar style="light" />
      {fontsLoaded ? <Root /> : <View style={{ flex: 1, backgroundColor: C.bg0 }} />}
    </SafeAreaProvider>
  );
}
