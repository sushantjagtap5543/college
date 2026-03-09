# Vehicle Icons — SVG Folder

## 📁 Location
```
frontend/public/vehicle-icons/
```

## ✅ How to Change an Icon

1. Open this folder
2. Replace any `.svg` file with your new design
3. **Refresh the browser** — the icon updates everywhere automatically

No code changes needed.

---

## 📐 SVG Design Rules

| Rule | Detail |
|------|--------|
| **Size** | `viewBox="0 0 40 40"` |
| **Direction** | Vehicle must face **UPWARD (north)** in the file |
| **Background** | Must be **transparent** |
| **Colors** | Use `white` fills with `rgba(0,0,0,0.x)` for dark details |

> The system automatically rotates the SVG based on the vehicle's live GPS heading.
> If the vehicle moves north → SVG faces up. East → rotates 90°. South → rotates 180°, etc.

---

## 📃 Available Files

| File | Used for |
|------|---------|
| `car.svg` | Sedan, SUV*, Taxi*, Sports* |
| `suv.svg` | SUV (independent design) |
| `pickup.svg` | Pickup truck |
| `van.svg` | Van, Minibus |
| `truck.svg` | Heavy truck, Box truck* |
| `bus.svg` | City bus, Coach* |
| `motorcycle.svg` | Motorcycle, Scooter*, Bicycle* |
| `auto.svg` | Auto rickshaw (3-wheeler) |
| `ambulance.svg` | Ambulance |
| `police.svg` | Police cruiser |
| `fire.svg` | Fire engine |
| `tractor.svg` | Tractor / Farm vehicle |
| `tanker.svg` | Fuel tanker |
| `jcb.svg` | JCB / Excavator / Construction |
| `boat.svg` | Boat, Ship* |

*\* These types share/alias to another file. To give them an independent icon, create a new file with the exact alias name.*

---

## 🎨 Color System

The **colored circle backdrop** behind each vehicle icon is the "body color" selected from the portal's icon picker.  
The SVG file itself should use **white + transparent** fills so the chosen color shows through.

---

## 💡 Adding a New Vehicle Type

1. Create `your-type.svg` in this folder (facing upward)
2. Add an entry to `VEHICLE_ICON_OPTIONS` in `src/utils/statusIcons.jsx`:
   ```js
   { id: 'your-type', label: 'Your Label', emoji: '🚗' }
   ```
3. Done — the icon picker will show it automatically
