# iOS WidgetKit scaffold

This directory contains the WidgetKit scaffold for Meep.

## Files
- `MeepWidgets.swift`: widget bundle, timeline provider, and small/medium views.
- `WidgetDataReader.swift`: reads the shared payload from App Group `UserDefaults`.
- `WidgetModels.swift`: payload and entry models.

## Xcode setup checklist
1. Run `npx expo prebuild --platform ios` (or `npx expo run:ios`) to generate native project.
2. Open the generated Xcode workspace and add a new **Widget Extension** target.
3. Add these Swift files to the widget target.
4. Ensure widget target uses App Group `group.com.themeepcompany.meep`.
5. Ensure app target + widget target both include the same App Group entitlement.
6. Build and run on iOS simulator/device, then add the widget from the home screen.
