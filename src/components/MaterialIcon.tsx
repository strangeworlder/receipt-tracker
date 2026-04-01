import React from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { colors } from "@/theme/colors";

type IconLibrary = "community" | "material";

interface IconMapping {
  name: string;
  library: IconLibrary;
}

/** Maps Material Symbols/mockup icon names to available vector icon equivalents */
const ICON_MAP: Record<string, IconMapping> = {
  dashboard: { name: "view-dashboard", library: "community" },
  document_scanner: { name: "file-document-scan-outline", library: "community" },
  call_split: { name: "call-split", library: "community" },
  verified_user: { name: "shield-check", library: "community" },
  folder_shared: { name: "folder-account", library: "community" },
  settings: { name: "cog", library: "community" },
  add: { name: "plus", library: "community" },
  close: { name: "close", library: "community" },
  check: { name: "check", library: "community" },
  delete: { name: "delete", library: "community" },
  edit: { name: "pencil", library: "community" },
  share: { name: "share-variant", library: "community" },
  sync: { name: "sync", library: "community" },
  receipt: { name: "receipt", library: "community" },
  camera: { name: "camera", library: "community" },
  photo: { name: "image", library: "community" },
  flash_on: { name: "flash", library: "community" },
  flash_off: { name: "flash-off", library: "community" },
  arrow_back: { name: "arrow-left", library: "community" },
  arrow_forward: { name: "arrow-right", library: "community" },
  chevron_right: { name: "chevron-right", library: "community" },
  chevron_left: { name: "chevron-left", library: "community" },
  expand_more: { name: "chevron-down", library: "community" },
  expand_less: { name: "chevron-up", library: "community" },
  person: { name: "account", library: "community" },
  group: { name: "account-group", library: "community" },
  attach_money: { name: "currency-usd", library: "community" },
  calendar_today: { name: "calendar", library: "community" },
  location_on: { name: "map-marker", library: "community" },
  directions_car: { name: "car", library: "community" },
  local_gas_station: { name: "gas-station", library: "community" },
  hotel: { name: "bed", library: "community" },
  restaurant: { name: "food", library: "community" },
  flight: { name: "airplane", library: "community" },
  shopping_cart: { name: "cart", library: "community" },
  build: { name: "hammer-wrench", library: "community" },
  warning: { name: "alert", library: "community" },
  error: { name: "alert-circle", library: "community" },
  info: { name: "information", library: "community" },
  check_circle: { name: "check-circle", library: "community" },
  star: { name: "star", library: "community" },
  favorite: { name: "heart", library: "community" },
  notifications: { name: "bell", library: "community" },
  search: { name: "magnify", library: "community" },
  filter_list: { name: "filter-variant", library: "community" },
  more_vert: { name: "dots-vertical", library: "community" },
  more_horiz: { name: "dots-horizontal", library: "community" },
  upload: { name: "upload", library: "community" },
  download: { name: "download", library: "community" },
  cloud_done: { name: "cloud-check", library: "community" },
  cloud_off: { name: "cloud-off-outline", library: "community" },
  bolt: { name: "lightning-bolt", library: "community" },
  notification_important: { name: "bell-alert", library: "community" },
  photo_camera: { name: "camera", library: "community" },
  shopping_bag: { name: "shopping", library: "community" },
  local_cafe: { name: "coffee", library: "community" },
  receipt_long: { name: "receipt", library: "community" },
  terrain: { name: "terrain", library: "material" },
  apple: { name: "apple", library: "community" },
  google: { name: "google", library: "community" },
  notifications_active: { name: "bell-ring", library: "community" },
  link: { name: "link-variant", library: "community" },
  open_in_new: { name: "open-in-new", library: "community" },
  drive_folder_upload: { name: "folder-upload", library: "community" },
  groups: { name: "account-multiple", library: "community" },
  balance: { name: "scale-balance", library: "community" },
  savings: { name: "piggy-bank", library: "community" },
  person_add: { name: "account-plus", library: "community" },
  check_circle_outline: { name: "check-circle-outline", library: "community" },
};

interface MaterialIconProps {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
}

export function MaterialIcon({
  name,
  size = 24,
  color = colors.onSurface,
}: MaterialIconProps) {
  const mapping = ICON_MAP[name];

  if (!mapping) {
    return (
      <MaterialCommunityIcons
        name="help-circle-outline"
        size={size}
        color={color}
      />
    );
  }

  if (mapping.library === "material") {
    return (
      <MaterialIcons
        name={mapping.name as React.ComponentProps<typeof MaterialIcons>["name"]}
        size={size}
        color={color}
      />
    );
  }

  return (
    <MaterialCommunityIcons
      name={mapping.name as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
      size={size}
      color={color}
    />
  );
}
