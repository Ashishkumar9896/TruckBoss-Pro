CREATE DATABASE IF NOT EXISTS `trucks` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT ENCRYPTION='N';
USE `trucks`;

SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT;
SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS;
SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION;
SET NAMES utf8;
SET @OLD_TIME_ZONE=@@TIME_ZONE;
SET TIME_ZONE='+00:00';
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0;




DROP TABLE IF EXISTS `customer_archive`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
CREATE TABLE `customer_archive` (
  `archive_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone_no` varchar(50) DEFAULT NULL,
  `address` text,
  `amount_paid` decimal(12,2) DEFAULT '0.00',
  `deleted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`archive_id`),
  UNIQUE KEY `uq_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `customer_archive` WRITE;
ALTER TABLE `customer_archive` DISABLE KEYS;
ALTER TABLE `customer_archive` ENABLE KEYS;
UNLOCK TABLES;




DROP TABLE IF EXISTS `customer_transactions`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
CREATE TABLE `customer_transactions` (
  `transaction_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_method` varchar(50) NOT NULL DEFAULT 'Cash',
  `notes` varchar(255) DEFAULT NULL,
  `payment_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_id`),
  KEY `idx_customer_transactions_customer_id` (`customer_id`),
  CONSTRAINT `fk_customer_transactions_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `customer_transactions` WRITE;
ALTER TABLE `customer_transactions` DISABLE KEYS;
INSERT INTO `customer_transactions` VALUES (1,1,5000.00,'Cash',NULL,'2026-03-26','2026-03-26 09:00:56');
ALTER TABLE `customer_transactions` ENABLE KEYS;
UNLOCK TABLES;




DROP TABLE IF EXISTS `customers`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
CREATE TABLE `customers` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `phone_no` varchar(16) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT '0.00',
  `balance` decimal(12,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date` date DEFAULT NULL,
  `follow_up_notes` text,
  PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `customers` WRITE;
ALTER TABLE `customers` DISABLE KEYS;
INSERT INTO `customers` VALUES (1,'Ashish',NULL,'Post nawada',5000.00,0.00,'2026-03-25 16:30:44',NULL,NULL);
ALTER TABLE `customers` ENABLE KEYS;
UNLOCK TABLES;




DROP TABLE IF EXISTS `driver_details`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
CREATE TABLE `driver_details` (
  `driver_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(40) NOT NULL,
  `phone_no` varchar(16) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `salary` decimal(10,2) DEFAULT '0.00',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`driver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `driver_details` WRITE;
ALTER TABLE `driver_details` DISABLE KEYS;
ALTER TABLE `driver_details` ENABLE KEYS;
UNLOCK TABLES;




DROP TABLE IF EXISTS `fuel_details`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `fuel_details` WRITE;
ALTER TABLE `fuel_details` DISABLE KEYS;
ALTER TABLE `fuel_details` ENABLE KEYS;
UNLOCK TABLES;




DROP TABLE IF EXISTS `maintenance_records`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
CREATE TABLE `maintenance_records` (
  `maintenance_id` int NOT NULL AUTO_INCREMENT,
  `truck_id` int DEFAULT NULL,
  `service_date` date NOT NULL,
  `cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `description` text,
  `proof_document` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`maintenance_id`),
  KEY `truck_id` (`truck_id`),
  CONSTRAINT `maintenance_records_ibfk_1` FOREIGN KEY (`truck_id`) REFERENCES `truck_details` (`truck_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `maintenance_records` WRITE;
ALTER TABLE `maintenance_records` DISABLE KEYS;
ALTER TABLE `maintenance_records` ENABLE KEYS;
UNLOCK TABLES;




DROP TABLE IF EXISTS `trips`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
CREATE TABLE `trips` (
  `trip_id` int NOT NULL AUTO_INCREMENT,
  `truck_id` int DEFAULT NULL,
  `driver_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT '0.00',
  `status` enum('completed','ongoing','pending') DEFAULT 'pending',
  `trip_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `material_type` varchar(255) DEFAULT NULL,
  `quantity` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`trip_id`),
  KEY `fk_trip_truck` (`truck_id`),
  KEY `fk_trip_driver` (`driver_id`),
  CONSTRAINT `fk_trip_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_trip_truck` FOREIGN KEY (`truck_id`) REFERENCES `truck_details` (`truck_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `trips` WRITE;
ALTER TABLE `trips` DISABLE KEYS;
INSERT INTO `trips` VALUES (1,2,NULL,1,0.00,'pending','2026-03-25','2026-03-25 16:33:14','',0.00);
ALTER TABLE `trips` ENABLE KEYS;
UNLOCK TABLES;




DROP TABLE IF EXISTS `truck_details`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
CREATE TABLE `truck_details` (
  `truck_id` int NOT NULL AUTO_INCREMENT,
  `truck_no` varchar(20) NOT NULL,
  `driver_id` int DEFAULT NULL,
  `status` enum('Available','In Use','Maintenance') DEFAULT 'Available',
  `maintenance` varchar(50) DEFAULT 'Not Required',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`truck_id`),
  UNIQUE KEY `truck_no` (`truck_no`),
  KEY `fk_truck_driver` (`driver_id`),
  CONSTRAINT `fk_truck_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver_details` (`driver_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `truck_details` WRITE;
ALTER TABLE `truck_details` DISABLE KEYS;
INSERT INTO `truck_details` VALUES (1,'UP-16-GH-7890',NULL,'Available','Not Required','2026-03-25 13:46:34'),(2,'MP-09-KL-6789',NULL,'In Use','Not Required','2026-03-25 16:26:37');
ALTER TABLE `truck_details` ENABLE KEYS;
UNLOCK TABLES;




DROP TABLE IF EXISTS `users`;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(50) DEFAULT NULL,
  `role` enum('admin','manager','driver') DEFAULT 'admin',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET character_set_client = @saved_cs_client;




LOCK TABLES `users` WRITE;
ALTER TABLE `users` DISABLE KEYS;
INSERT INTO `users` VALUES (1,'ashishkumarjha9896@gmail.com','Ashish@9896','Ashish','admin','2026-03-23 12:04:21'),(2,'admin@gmail.com','Admin@1234','Admin','admin','2026-03-26 12:42:42');
ALTER TABLE `users` ENABLE KEYS;
UNLOCK TABLES;
SET TIME_ZONE=@OLD_TIME_ZONE;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT;
SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS;
SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION;
SET SQL_NOTES=@OLD_SQL_NOTES;
