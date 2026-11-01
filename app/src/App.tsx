import { useGeometry } from "./layout/geometry";
import { AppProvider } from "./state/store";
import { AppShell } from "./shell/AppShell";

export default function App() {
  const geo = useGeometry();
  return (
    <AppProvider geo={geo}>
      <AppShell />
    </AppProvider>
  );
}
