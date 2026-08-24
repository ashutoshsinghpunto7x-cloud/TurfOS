# Third-Party Licenses — Playbox

Licenses below were read directly from each package's `package.json` in `node_modules` (verified, not assumed). All are permissive open-source licenses (MIT/ISC) that permit commercial use, modification, and distribution with attribution.

| Package | Version (declared) | License |
|---|---|---|
| @expo/metro-runtime | ~6.1.2 | MIT |
| @react-native-async-storage/async-storage | 2.2.0 | MIT |
| @react-native-picker/picker | 2.11.1 | MIT |
| @react-navigation/bottom-tabs | ^7.15.10 | MIT |
| @react-navigation/drawer | ^7.9.9 | MIT |
| @react-navigation/native | ^7.2.2 | MIT |
| @react-navigation/native-stack | ^7.14.12 | MIT |
| @supabase/supabase-js | ^2.105.0 | MIT |
| expo | ~54.0.33 | MIT |
| expo-blur | ~15.0.8 | MIT |
| expo-dev-client | ~6.0.21 | MIT |
| expo-font | ~14.0.11 | MIT |
| expo-image-picker | ~17.0.11 | MIT |
| expo-linear-gradient | ~15.0.8 | MIT |
| expo-notifications | ~0.32.17 | MIT |
| expo-secure-store | ~15.0.8 | MIT |
| expo-status-bar | ~3.0.9 | MIT |
| expo-updates | ~29.0.17 | MIT |
| lucide-react-native | ^1.18.0 | ISC |
| react | ^19.1.0 | MIT |
| react-dom | 19.1.0 | MIT |
| react-native | ^0.81.5 | MIT |
| react-native-gesture-handler | ~2.28.0 | MIT |
| react-native-razorpay | ^3.0.0 | MIT |
| react-native-reanimated | ~4.1.1 | MIT |
| react-native-safe-area-context | ~5.6.0 | MIT |
| react-native-screens | ~4.16.0 | MIT |
| react-native-svg | 15.12.1 | MIT |
| react-native-web | ^0.21.0 | MIT |
| react-native-worklets | ^0.5.1 | MIT |
| zustand | ^5.0.12 | MIT |
| @types/react (dev) | ~19.1.10 | MIT |
| typescript (dev) | ~5.9.2 | Apache-2.0 |

## Third-Party Services (not npm packages, but integrated as external services)
| Service | License / Terms |
|---|---|
| Supabase | Backend-as-a-service — subject to [Supabase Terms of Service](https://supabase.com/terms) |
| Razorpay | Payment gateway — subject to [Razorpay Terms of Service](https://razorpay.com/terms/) |

## Notes
- MIT and ISC licenses require only that the original copyright notice and license text be preserved somewhere reasonably accessible (commonly satisfied by an in-app "Open Source Licenses" / "Licenses" screen, or a bundled `LICENSES.txt`). **Manual Input Required:** consider adding an in-app "Open Source Licenses" screen (many Expo/RN apps use `expo-updates`' bundled license aggregation or a simple static screen listing the table above) before public launch — not strictly required by Google Play policy, but a widely followed best practice and sometimes expected for App Store-adjacent review consistency.
- This list reflects direct dependencies declared in `package.json`. Transitive (sub-)dependencies are not individually enumerated here; for a fully exhaustive machine-generated list, run `npx license-checker --summary` from the `TurfOS/` directory.
