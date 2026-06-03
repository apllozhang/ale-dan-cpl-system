ALTER TABLE `certifications` ADD `productCategory` varchar(64);--> statement-breakpoint
ALTER TABLE `certifications` ADD `productSeries` varchar(128);--> statement-breakpoint
CREATE INDEX `certifications_productCategory_idx` ON `certifications` (`productCategory`);