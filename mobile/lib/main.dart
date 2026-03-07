import 'package:flutter/material.dart';

void main() {
  runApp(const GeoSurePathApp());
}

class GeoSurePathApp extends StatelessWidget {
  const GeoSurePathApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GeoSurePath Mobile',
      theme: ThemeData.dark().copyWith(
        primaryColor: const Color(0xFF14B8A6), // Teal brand color
        scaffoldBackgroundColor: const Color(0xFF0F172A),
      ),
      home: const LoginScreen(),
    );
  }
}

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.map_rounded, size: 64, color: Color(0xFF14B8A6)),
              const SizedBox(height: 16),
              const Text(
                'GeoSurePath Mobile',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Secure Client Portal',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 48),
              TextField(
                decoration: InputDecoration(
                  hintText: 'Email / Username',
                  filled: true,
                  fillColor: Colors.white10,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                obscureText: true,
                decoration: InputDecoration(
                  hintText: 'Password',
                  filled: true,
                  fillColor: Colors.white10,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF14B8A6),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (context) => const MapScreen()),
                    );
                  },
                  child: const Text('Login securely', style: TextStyle(fontSize: 18, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                   Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const RegistrationScreen()),
                    );
                },
                child: const Text('Register New Device', style: TextStyle(color: Color(0xFF14B8A6))),
              )
            ],
          ),
        ),
      ),
    );
  }
}

class RegistrationScreen extends StatelessWidget {
  const RegistrationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bind Hardware'), backgroundColor: Colors.transparent, elevation: 0),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const Text('Enter your 15-digit IMEI to link the device. The 13-digit M2M SIM will automatically populate from the stock database.', style: TextStyle(color: Colors.grey)),
            const SizedBox(height: 24),
            TextField(
                decoration: InputDecoration(
                  hintText: '15-Digit IMEI',
                  filled: true, fillColor: Colors.white10,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
            ),
            const SizedBox(height: 16),
             TextField(
                enabled: false,
                decoration: InputDecoration(
                  hintText: 'M2M SIM (Auto-fetching...)',
                  filled: true, fillColor: Colors.black26,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
            ),
            const Spacer(),
            SizedBox(
                width: double.infinity, height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF14B8A6)),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Register to Master DB', style: TextStyle(color: Colors.white)),
                ),
            ),
          ],
        ),
      ),
    );
  }
}

class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Tracker'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () {
               Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const ProfileScreen()),
                );
            },
          )
        ],
      ),
      body: Stack(
        children: [
          Container(
            color: Colors.black12,
            child: const Center(
              child: Text('Map View Rendering Engine Here\n(Real-time TCP Socket connected)', textAlign: TextAlign.center),
            ),
          ),
          Positioned(
            bottom: 24, left: 24, right: 24,
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 10)],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Vehicle A (AIS-140)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                      Text('Status: Moving (60 km/h)', style: TextStyle(color: Colors.greenAccent)),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.power_settings_new, color: Colors.redAccent),
                    onPressed: () {
                      // Trigger Kill switch logic -> Saves to Audit Logs
                    },
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile & Security'), backgroundColor: Colors.transparent, elevation: 0),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
             const Text('Update your credentials. All changes are strictly logged by the Admin Audit System.', style: TextStyle(color: Colors.amber)),
             const SizedBox(height: 32),
             TextField(
                decoration: InputDecoration(
                  hintText: 'New Username',
                  filled: true, fillColor: Colors.white10,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
            ),
            const SizedBox(height: 16),
            TextField(
                obscureText: true,
                decoration: InputDecoration(
                  hintText: 'New Password',
                  filled: true, fillColor: Colors.white10,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
            ),
            const Spacer(),
            SizedBox(
                width: double.infinity, height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF14B8A6)),
                  onPressed: () {
                     // Submit to backend, generate Audit Log
                     Navigator.pop(context);
                  },
                  child: const Text('Save Changes & Create Audit Log', style: TextStyle(color: Colors.white)),
                ),
            ),
          ],
        ),
      ),
    );
  }
}
