CREATE TABLE `faq_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`employee_role` text NOT NULL,
	`status` text NOT NULL,
	`answer` text,
	`category` text,
	`source_reference` text,
	`created_at` text NOT NULL,
	`published_at` text,
	`review_by` text
);
