USE `trucks`;

INSERT INTO `driver_details` (`name`, `licence_no`, `phone_no`, `address`, `salary`) VALUES
('Ramesh Singh',    'DL-0420110012345', '+91-9876543210', '45, Karol Bagh, Delhi',         25000.00),
('Suresh Yadav',    'RJ-1320200054321', '+91-9123456780', '12, MI Road, Jaipur',           22000.00),
('Vikram Meena',    'HR-0620190067890', '+91-9988776655', '78, Sector 14, Gurgaon',        28000.00),
('Mahesh Gurjar',   'RJ-2720180011223', '+91-9871234560', '34, Station Road, Udaipur',     21000.00),
('Deepak Sharma',   'UP-1620210098765', '+91-9654321098', '56, Civil Lines, Lucknow',      24000.00),
('Arjun Patel',     'GJ-0120220033445', '+91-9765432109', '89, SG Highway, Ahmedabad',     26000.00),
('Ravi Verma',      'MP-0920200077889', '+91-9543210987', '23, New Market, Bhopal',        23000.00);

INSERT INTO `truck_details` (`truck_no`, `driver_id`, `status`, `maintenance`) VALUES
('RJ-14-GA-1234', 1, 'Available',   'Not Required'),
('DL-01-AB-5678', 2, 'In Use',      'Not Required'),
('HR-55-CD-9012', 3, 'Available',   'Not Required'),
('RJ-27-EF-3456', 4, 'In Use',      'Not Required'),
('UP-16-GH-7890', 5, 'Maintenance', 'Engine Service Due'),
('GJ-01-IJ-2345', 6, 'Available',   'Not Required'),
('MP-09-KL-6789', 7, 'Available',   'Tyre Replacement Soon'),
('RJ-14-MN-1122', NULL, 'Available', 'Not Required');

INSERT INTO `customers` (`name`, `phone_no`, `address`, `amount_paid`, `balance`) VALUES
('Rajesh Kumar',        '+91-9811223344', '22, Nehru Place, Delhi',       182000.00, 18000.00),
('Patel & Co',          '+91-9822334455', '45, CG Road, Ahmedabad',      450000.00, 50000.00),
('Gupta Enterprises',   '+91-9833445566', '78, Vaishali Nagar, Jaipur',  200000.00, 30000.00),
('Meera Textiles',      '+91-9844556677', '12, Ring Road, Surat',        900000.00,     0.00),
('Shree Balaji Trans',  '+91-9855667788', '56, Jodhpur Road, Pali',      250000.00, 12000.00),
('Singh Logistics',     '+91-9866778899', '90, GT Road, Ludhiana',       320000.00, 25000.00),
('Bharat Movers',       '+91-9877889900', '15, MG Road, Pune',           175000.00, 15000.00);

INSERT INTO `trips` (`from_city`, `to_city`, `truck_id`, `driver_id`, `customer_id`, `amount`, `status`, `trip_date`) VALUES
('Delhi',      'Chandigarh', 1, 1, 1, 14500.00, 'completed', '2026-02-20'),
('Jaipur',     'Udaipur',    2, 2, 2, 24800.00, 'ongoing',   '2026-02-28'),
('Jodhpur',    'Jaipur',     3, 3, 3, 20400.00, 'pending',   '2026-03-05'),
('Delhi',      'Lucknow',    4, 4, 4, 35000.00, 'completed', '2026-02-15'),
('Surat',      'Mumbai',     1, 1, 5, 18500.00, 'completed', '2026-02-10'),
('Jaipur',     'Delhi',      2, 2, 1, 12000.00, 'completed', '2026-01-25'),
('Ahmedabad',  'Jaipur',     3, 3, 2, 28000.00, 'completed', '2026-01-18'),
('Lucknow',    'Varanasi',   4, 4, 3, 22000.00, 'ongoing',   '2026-03-01'),
('Delhi',      'Jaipur',     6, 6, 6, 19000.00, 'completed', '2026-02-22'),
('Bhopal',     'Indore',     7, 7, 7, 16500.00, 'pending',   '2026-03-08'),
('Pune',       'Mumbai',     1, 1, 7, 11000.00, 'completed', '2026-02-05'),
('Ahmedabad',  'Surat',      6, 6, 4, 13500.00, 'completed', '2026-01-30');

INSERT INTO `fuel_details` (`truck_id`, `driver_id`, `liters`, `price`, `fuel_date`) VALUES
(1, 1, 120.00, 10800.00, '2026-02-20'),
(2, 2, 150.00, 13500.00, '2026-02-28'),
(3, 3,  80.00,  7200.00, '2026-02-25'),
(4, 4, 200.00, 18000.00, '2026-02-15'),
(1, 1, 100.00,  9000.00, '2026-02-10'),
(5, 5, 130.00, 11700.00, '2026-02-22'),
(6, 6, 110.00,  9900.00, '2026-02-22'),
(7, 7,  90.00,  8100.00, '2026-02-26'),
(2, 2, 140.00, 12600.00, '2026-01-25'),
(1, 1,  95.00,  8550.00, '2026-02-05');

SELECT 'drivers' AS `table_name`, COUNT(*) AS `rows` FROM driver_details
UNION ALL SELECT 'trucks', COUNT(*) FROM truck_details
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'trips', COUNT(*) FROM trips
UNION ALL SELECT 'fuel', COUNT(*) FROM fuel_details;
