// Dust devils: the pipeline's Dust Devil Heating Index (MarsDataPipline/dust_devil/) for one sol,
// in three levels (low / moderate / high = top 50 / 30 / 10 % of reference sol 1850's heating).
// It replaces the design's fake moving "Dust Devil #84". It is a heuristic of how hard the Sun heats
// the ground between 9:00 and 16:00, not a probability or a set of detected dust devils.
import { Image } from "react-native";
import { useApp } from "../../state/store";
import { dataUri, useMapData } from "../data";

export function DustDevilLayer() {
  const { state: S } = useApp();
  const dd = useMapData().manifest?.dustDevil;
  if (!dd || !S.hazOn || !S.hazTypes.weather) return null;
  const sol = dd.sols.find(s => s.sol === S.dustSol) ?? dd.sols[0];
  const [x, y, w, h] = dd.rect;
  return (
    <Image
      source={{ uri: dataUri(sol.path) }}
      fadeDuration={0}
      resizeMode="stretch"
      style={{ position: "absolute", left: x, top: y, width: w, height: h }}
    />
  );
}
