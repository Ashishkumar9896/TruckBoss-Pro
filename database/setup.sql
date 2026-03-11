CREATE DATABASE IF NOT EXISTS `trucks`;
USE `trucks`;

-- Drop in reverse order to avoid FK issues
DROP TABLE IF EXISTS `fuel_details`;
DROP TABLE IF EXISTS `trips`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `truck_details`;
DROP TABLE IF EXISTS `driver_details`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
    `user_id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(50) DEFAULT NULL,
    `role` ENUM('admin','manager','driver') DEFAULT 'admin',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `driver_details` (
    `driver_id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(40) NOT NULL,
    `licence_no` VARCHAR(20) NOT NULL,
    `phone_no` VARCHAR(16) DEFAULT NULL,
    `address` VARCHAR(100) DEFAULT NULL,
    `salary` DECIMAL(10,2) DEFAULT 0.00,
    `status` ENUM('active','inactive') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`driver_id`),
    UNIQUE KEY `licence_no` (`licence_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `truck_details` (
    `truck_id` INT NOT NULL AUTO_INCREMENT,
    `truck_no` VARCHAR(20) NOT NULL,
    `driver_id` INT DEFAULT NULL,
    `status` ENUM('Available','In Use','Maintenance') DEFAULT 'Available',
    `maintenance` VARCHAR(50) DEFAULT 'Not Required',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`truck_id`),
    UNIQUE KEY `truck_no` (`truck_no`),
    CONSTRAINT `fk_truck_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `customers` (
    `customer_id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `phone_no` VARCHAR(16) DEFAULT NULL,
    `address` VARCHAR(100) DEFAULT NULL,
    `amount_paid` DECIMAL(12,2) DEFAULT 0.00,
    `balance` DECIMAL(12,2) DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `trips` (
    `trip_id` INT NOT NULL AUTO_INCREMENT,
    `from_city` VARCHAR(50) NOT NULL,
    `to_city` VARCHAR(50) NOT NULL,
    `truck_id` INT DEFAULT NULL,
    `driver_id` INT DEFAULT NULL,
    `customer_id` INT DEFAULT NULL,
    `amount` DECIMAL(12,2) DEFAULT 0.00,
    `status` ENUM('completed','ongoing','pending') DEFAULT 'pending',
    `trip_date` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`trip_id`),
    CONSTRAINT `fk_trip_truck` FOREIGN KEY (`truck_id`) REFERENCES `truck_details` (`truck_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_trip_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_trip_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `fuel_details` (
    `fuel_id` INT NOT NULL AUTO_INCREMENT,
    `truck_id` INT DEFAULT NULL,
    `driver_id` INT DEFAULT NULL,
    `liters` DECIMAL(10,2) NOT NULL,
    `price` DECIMAL(10,2) NOT NULL,
    `fuel_date` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`fuel_id`),
    CONSTRAINT `fk_fuel_truck` FOREIGN KEY (`truck_id`) REFERENCES `truck_details` (`truck_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_fuel_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
