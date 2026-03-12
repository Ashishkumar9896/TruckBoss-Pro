CREATE DATABASE IF NOT EXISTS trucks; USE trucks;

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity` varchar(100) NOT NULL,
  `entity_id` int DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `customers` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `phone_no` varchar(16) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT '0.00',
  `balance` decimal(12,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `driver_details` (
  `driver_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(40) NOT NULL,
  `licence_no` varchar(20) NOT NULL,
  `phone_no` varchar(16) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `salary` decimal(10,2) DEFAULT '0.00',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`driver_id`),
  UNIQUE KEY `licence_no` (`licence_no`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `fuel_details` (
  `fuel_id` int NOT NULL AUTO_INCREMENT,
  `truck_id` int DEFAULT NULL,
  `driver_id` int DEFAULT NULL,
  `liters` decimal(10,2) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `fuel_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`fuel_id`),
  KEY `fk_fuel_truck` (`truck_id`),
  KEY `fk_fuel_driver` (`driver_id`),
  CONSTRAINT `fk_fuel_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fuel_truck` FOREIGN KEY (`truck_id`) REFERENCES `truck_details` (`truck_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `maintenance_records` (
  `maintenance_id` int NOT NULL AUTO_INCREMENT,
  `truck_id` int DEFAULT NULL,
  `service_date` date NOT NULL,
  `cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`maintenance_id`),
  KEY `truck_id` (`truck_id`),
  CONSTRAINT `maintenance_records_ibfk_1` FOREIGN KEY (`truck_id`) REFERENCES `truck_details` (`truck_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `role_permissions` (
  `role_name` varchar(50) NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`role_name`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `trips` (
  `trip_id` int NOT NULL AUTO_INCREMENT,
  `from_city` varchar(50) NOT NULL,
  `to_city` varchar(50) NOT NULL,
  `truck_id` int DEFAULT NULL,
  `driver_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT '0.00',
  `status` enum('completed','ongoing','pending') DEFAULT 'pending',
  `trip_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `toll_amount` decimal(10,2) DEFAULT '0.00',
  `misc_expenses` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`trip_id`),
  KEY `fk_trip_truck` (`truck_id`),
  KEY `fk_trip_driver` (`driver_id`),
  KEY `fk_trip_customer` (`customer_id`),
  CONSTRAINT `fk_trip_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_trip_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_trip_truck` FOREIGN KEY (`truck_id`) REFERENCES `truck_details` (`truck_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `truck_details` (
  `truck_id` int NOT NULL AUTO_INCREMENT,
  `truck_no` varchar(20) NOT NULL,
  `driver_id` int DEFAULT NULL,
  `status` enum('Available','In Use','Maintenance') DEFAULT 'Available',
  `maintenance` varchar(50) DEFAULT 'Not Required',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`truck_id`),
  UNIQUE KEY `truck_no` (`truck_no`),
  KEY `fk_truck_driver` (`driver_id`),
  CONSTRAINT `fk_truck_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(50) DEFAULT NULL,
  `role` enum('admin','manager','driver') DEFAULT 'admin',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `driver_id` int DEFAULT NULL,
  `status` enum('active','suspended') DEFAULT 'active',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_user_driver` (`driver_id`),
  CONSTRAINT `fk_user_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS=1;

INSERT INTO users (email, password, full_name, role) VALUES ('port3307_9c88f6c7@example.com', '$2a$12$TahJHqgMkUTKvke8OZVYfOSS/xRXEH97DyfkNPVhbvN5JY7lGxi2i', 'Port Check', 'admin'), ('e2e_4c7b1a55@example.com', '$2a$12$9PQFSiyIOuZYwaKREDtMsOrdXQX/a2bwCxjroL0t3ErLvpHg3sP4G', 'E2E User', 'admin'), ('ashishkumarjha9896@gmail.com', '$2a$12$jHcccbC2yRCgqSANiqt.0.T6b48/IsLE/pN3UetToJ.FaS.L8w5sO', 'Ashish', 'admin'), ('dash_28928403@example.com', '$2a$12$cVnZFjk/6tv7o261CiaeFOnLdmzd2DFz2sCbJCMxb1V6vxmTdy/0G', 'Dash Test', 'admin'), ('pro_e2709775@example.com', '$2a$12$LBwoq8Ul12BRjquFd.TQgO/a/uihBeC4DpvK/dc.WXKisZtgol6MK', 'Pro Check', 'admin'), ('limitcheck_07544e75@example.com', '$2a$12$JqpWDItcVebe31RsQw9jROzZgCR6PLvG7oweroAbhFuCGA.ZHMsbi', 'Limit Check', 'admin'), ('join_0e7b36a2@example.com', '$2a$12$f9/isOEMvhEeN2pyakNYeePh.WDvy0lcWNxSo91L9tkB7.FDItnHa', 'Join Check', 'admin'), ('admin@tb.com', '$2a$10$f0Ay4AhUidIh2UDDpJl4T.QT8l0dVN5C3HcjNuuUtHFymKn0FFhqm', 'Admin User', 'admin'), ('manager@tb.com', '$2a$10$f0Ay4AhUidIh2UDDpJl4T.QT8l0dVN5C3HcjNuuUtHFymKn0FFhqm', 'Manager User', 'manager'), ('driver@tb.com', '$2a$10$FRZhkJVzBAgx6dVWBPS5ze6om3Wn1xuXIY3vg7QPDxJyoHke.LEyO', 'Driver User', 'driver'), ('tester@test.com', '$2a$12$pdKQb53JPqMuR9pZKVqJIuGEp6gl3MPscM1bMolIdcM0w7R6nFJ1i', 'Tester', 'admin'), ('admin@truckboss.com', '$2a$12$xRyxBTYpdJfPYtEXYeaDluAsMrQnMHYStkYiVqFdTFUGeMZFEcctq', 'Admin', 'admin'), ('admin123@example.com', '$2a$12$9pqaPQ84Joc.8jK3vLHauOM4uvw2L.9oW55vmeO/ff7iAgqcl4hSq', 'Admin User', 'admin');
