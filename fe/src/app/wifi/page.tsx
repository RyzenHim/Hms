import type { Metadata } from "next";
import { WifiBillWorkspace } from "../../components/wifi/WifiBillWorkspace";

export const metadata: Metadata = {
  title: "WiFi Bill Generator | Document Workspace",
};

export default function WifiPage() {
  return <WifiBillWorkspace />;
}
