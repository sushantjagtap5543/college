-- Seed Roles
INSERT INTO roles (name, permissions) VALUES 
('ADMIN', '{"all": true}'),
('CLIENT', '{"fleet": true, "reports": true}')
ON CONFLICT (name) DO NOTHING;

-- Seed Initial Device Inventory
INSERT INTO device_inventory (imei, sim_number, is_assigned) VALUES 
('869727079043556', '8888888888', false),
('869727079043558', '9999999999', false),
('123456789012345', '7777777777', false),
('SIM100000000000', '0000000000', false)
ON CONFLICT (imei) DO NOTHING;
