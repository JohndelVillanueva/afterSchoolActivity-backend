-- CreateTable
CREATE TABLE `activitysession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activityId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ActivitySession_activityId_fkey`(`activityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `afterschoolactivity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `dayOfWeek` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NULL,
    `coachName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `photo` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,

    INDEX `Attendance_userId_fkey`(`userId`),
    UNIQUE INDEX `Attendance_sessionId_userId_key`(`sessionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_library` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NULL,
    `date` DATETIME(0) NULL,
    `rfid` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `borrowers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NULL,
    `rfid` TEXT NULL,
    `title` VARCHAR(255) NULL,
    `date_borrowed` DATETIME(0) NULL,
    `date_returned` DATETIME(0) NULL,
    `remarks` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buyers` (
    `buyer_id` INTEGER NOT NULL AUTO_INCREMENT,
    `buyer_name` VARCHAR(255) NOT NULL,
    `rfid` BIGINT NULL,

    UNIQUE INDEX `buyer_name`(`buyer_name`),
    UNIQUE INDEX `rfid`(`rfid`),
    PRIMARY KEY (`buyer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clinic_history` (
    `Id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `grade` VARCHAR(255) NOT NULL,
    `complaint` VARCHAR(255) NOT NULL,
    `diagnose` VARCHAR(255) NOT NULL,
    `treatment` VARCHAR(255) NOT NULL,
    `vital_signs` VARCHAR(255) NOT NULL,
    `time_in` TIME(0) NOT NULL,
    `time_out` TIME(0) NOT NULL,
    `date` VARCHAR(255) NOT NULL,
    `remarks` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `countries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `countryCode` CHAR(2) NOT NULL DEFAULT '',
    `countryName` VARCHAR(100) NOT NULL DEFAULT '',
    `currencyCode` CHAR(3) NULL,
    `fipsCode` CHAR(2) NULL,
    `isoNumeric` CHAR(4) NULL,
    `north` VARCHAR(30) NULL,
    `south` VARCHAR(30) NULL,
    `east` VARCHAR(30) NULL,
    `west` VARCHAR(30) NULL,
    `capital` VARCHAR(100) NULL,
    `continentName` VARCHAR(100) NULL,
    `continent` CHAR(2) NULL,
    `languages` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrolledactivity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `activityId` INTEGER NOT NULL,
    `enrollmentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EnrolledActivity_activityId_fkey`(`activityId`),
    UNIQUE INDEX `EnrolledActivity_userId_activityId_key`(`userId`, `activityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empno` TEXT NOT NULL,
    `description` TEXT NOT NULL,
    `serial` TEXT NOT NULL,
    `dateout` DATETIME(0) NOT NULL,
    `datein` DATETIME(0) NOT NULL,
    `issuedby` TEXT NOT NULL,
    `remarks` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory__suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(255) NOT NULL,
    `itemsProvided` VARCHAR(255) NULL,
    `address` VARCHAR(255) NULL,
    `phoneNumber` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `rating` DECIMAL(3, 2) NULL DEFAULT 0.00,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_bookstore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_name` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `selling_price` FLOAT NOT NULL,
    `date` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `library_login` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(255) NULL,
    `password` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `logs_enroll` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ern` MEDIUMTEXT NOT NULL,
    `stage` INTEGER NOT NULL,
    `usertouch` MEDIUMTEXT NOT NULL,
    `touch` DATETIME(0) NOT NULL,
    `notes` MEDIUMTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nationalities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `countryCode` CHAR(2) NOT NULL DEFAULT '',
    `nationalityName` VARCHAR(100) NOT NULL DEFAULT '',
    `currencyCode` CHAR(3) NULL,
    `fipsCode` CHAR(2) NULL,
    `isoNumeric` CHAR(4) NULL,
    `north` VARCHAR(30) NULL,
    `south` VARCHAR(30) NULL,
    `east` VARCHAR(30) NULL,
    `west` VARCHAR(30) NULL,
    `capital` VARCHAR(100) NULL,
    `continentName` VARCHAR(100) NULL,
    `continent` CHAR(2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_code` VARCHAR(255) NOT NULL,
    `type_of_product` VARCHAR(255) NOT NULL,
    `name_of_product` VARCHAR(255) NOT NULL,
    `price_of_product` FLOAT NOT NULL,
    `date_created` DATETIME(0) NOT NULL,
    `last_touch` VARCHAR(25) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfid` BIGINT NOT NULL,
    `reqtype` MEDIUMTEXT NOT NULL,
    `reqdate` DATETIME(0) NOT NULL,
    `reqneed` DATETIME(0) NOT NULL,
    `reqdetails` MEDIUMTEXT NOT NULL,
    `approvedby` BIGINT NOT NULL,
    `approvedate` DATETIME(0) NOT NULL,
    `approvedfin` BIGINT NOT NULL,
    `approvedfindate` DATETIME(0) NOT NULL,
    `status` MEDIUMTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actid` TEXT NOT NULL,
    `subjcode` TEXT NOT NULL,
    `actlvl` INTEGER NOT NULL,
    `actsection` TEXT NOT NULL,
    `actdate` DATETIME(0) NOT NULL,
    `actcreate` TEXT NOT NULL,
    `actdesc` TEXT NOT NULL,
    `acttype` INTEGER NOT NULL,
    `actqtr` INTEGER NOT NULL,
    `maxscore` INTEGER NOT NULL,
    `flag` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_classattendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attendance` INTEGER NOT NULL,
    `subjid` TEXT NOT NULL,
    `studid` TEXT NOT NULL,
    `adate` DATETIME(0) NOT NULL,
    `tid` TEXT NOT NULL,
    `notes` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_coretable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `start` DECIMAL(10, 2) NOT NULL,
    `end` DECIMAL(10, 2) NOT NULL,
    `grade` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_corevalues` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `corevalue` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_payables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(240) NOT NULL,
    `reservation_fee` INTEGER NULL,
    `tuition_fee` INTEGER NULL,
    `other_fee` INTEGER NULL,
    `assessment_fee` INTEGER NULL,
    `registration_fee` INTEGER NULL,
    `special_permit` INTEGER NULL,
    `international_fee_old` INTEGER NULL,
    `international_fee_new` INTEGER NULL,
    `pta` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_recommendations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `esl` INTEGER NULL,
    `star` INTEGER NULL,
    `completion` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_scores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subjcode` TEXT NOT NULL,
    `actid` TEXT NOT NULL,
    `acttype` INTEGER NOT NULL,
    `sid` TEXT NOT NULL,
    `score` INTEGER NOT NULL,
    `maxscore` INTEGER NOT NULL,
    `qtr` INTEGER NOT NULL,
    `flag` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_studentcv` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sid` TEXT NOT NULL,
    `tid` TEXT NOT NULL,
    `subjid` TEXT NOT NULL,
    `qtr` INTEGER NOT NULL,
    `independence` DECIMAL(10, 0) NOT NULL,
    `confidence` DECIMAL(10, 0) NOT NULL,
    `respect` DECIMAL(10, 0) NOT NULL,
    `empathy` DECIMAL(10, 0) NOT NULL,
    `appreciation` DECIMAL(10, 0) NOT NULL,
    `tolerance` DECIMAL(10, 0) NOT NULL,
    `enthusiasm` DECIMAL(10, 0) NOT NULL,
    `conduct` DECIMAL(10, 0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_subjects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` TEXT NOT NULL,
    `tid` TEXT NOT NULL,
    `subjdesc` TEXT NOT NULL,
    `subjlevel` TEXT NOT NULL,
    `subjsection` TEXT NOT NULL,
    `assignedby` TEXT NOT NULL,
    `assigndate` DATETIME(0) NOT NULL,
    `percentww` FLOAT NOT NULL,
    `percentpt` FLOAT NOT NULL,
    `percentqt` FLOAT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_transmute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lowerl` FLOAT NOT NULL,
    `upperl` FLOAT NOT NULL,
    `transmuted` FLOAT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `s_verifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(255) NOT NULL,
    `section` VARCHAR(255) NOT NULL,
    `grade` INTEGER NOT NULL,
    `subject` VARCHAR(255) NULL,
    `request_unlock` INTEGER NULL,
    `flag` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_history` (
    `sale_id` INTEGER NOT NULL AUTO_INCREMENT,
    `buyer_id` INTEGER NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `sale_date` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `rfid` BIGINT NULL,

    INDEX `buyer_id`(`buyer_id`),
    PRIMARY KEY (`sale_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `start` DATETIME(0) NOT NULL,
    `end` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `studentdetails` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uniqid` TEXT NOT NULL,
    `visa` TEXT NOT NULL,
    `father` TEXT NOT NULL,
    `fathermail` TEXT NOT NULL,
    `fathernumber` TEXT NOT NULL,
    `fatherwork` TEXT NOT NULL,
    `fcompany` TEXT NOT NULL,
    `fsalary` TEXT NOT NULL,
    `mother` TEXT NOT NULL,
    `mothermail` TEXT NOT NULL,
    `mothernumber` TEXT NOT NULL,
    `motherwork` TEXT NOT NULL,
    `mcompany` TEXT NOT NULL,
    `msalary` TEXT NOT NULL,
    `street` TEXT NOT NULL,
    `barangay` TEXT NOT NULL,
    `city` TEXT NOT NULL,
    `postal` TEXT NOT NULL,
    `englishrw` TEXT NOT NULL,
    `englishv` TEXT NOT NULL,
    `languages` TEXT NOT NULL,
    `advclasses` TEXT NOT NULL,
    `remedial` TEXT NOT NULL,
    `skill` TEXT NOT NULL,
    `ashtma` TEXT NOT NULL,
    `ashtmar` TEXT NOT NULL,
    `allergy` TEXT NOT NULL,
    `allergyr` TEXT NOT NULL,
    `drug` TEXT NOT NULL,
    `drugr` TEXT NOT NULL,
    `speech` TEXT NOT NULL,
    `speechr` TEXT NOT NULL,
    `vision` TEXT NOT NULL,
    `visionr` TEXT NOT NULL,
    `hearing` TEXT NOT NULL,
    `hearingr` TEXT NOT NULL,
    `adhd` TEXT NOT NULL,
    `adhdr` TEXT NOT NULL,
    `healthcond` TEXT NOT NULL,
    `hospitalization` TEXT NOT NULL,
    `injuries` TEXT NOT NULL,
    `medication` TEXT NOT NULL,
    `general` TEXT NOT NULL,
    `generaldets` TEXT NOT NULL,
    `psych` TEXT NOT NULL,
    `psychdets` TEXT NOT NULL,
    `minor` TEXT NOT NULL,
    `emergency` TEXT NOT NULL,
    `hospital` TEXT NOT NULL,
    `otc` TEXT NOT NULL,
    `conforme` TEXT NOT NULL,
    `conformedate` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timeoff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfid` BIGINT NOT NULL,
    `leavetype` MEDIUMTEXT NOT NULL,
    `datefrom` DATE NOT NULL,
    `dateto` DATE NOT NULL,
    `ishalfday` INTEGER NOT NULL,
    `details` MEDIUMTEXT NOT NULL,
    `credit` INTEGER NOT NULL,
    `approval` MEDIUMTEXT NOT NULL,
    `approvedate` DATE NOT NULL,
    `hrnote` MEDIUMTEXT NOT NULL,
    `hrdate` DATE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `type_of_products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uniform` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfid` MEDIUMTEXT NOT NULL,
    `size` MEDIUMTEXT NOT NULL,
    `basic` MEDIUMTEXT NULL,
    `activity` MEDIUMTEXT NULL,
    `formal` MEDIUMTEXT NULL,
    `qtybasic` MEDIUMTEXT NOT NULL,
    `qtyact` MEDIUMTEXT NOT NULL,
    `qtyform` MEDIUMTEXT NOT NULL,
    `iscomplete` INTEGER NOT NULL,
    `lasttouch` MEDIUMTEXT NOT NULL,
    `dateordered` MEDIUMTEXT NULL,
    `datereleased` MEDIUMTEXT NULL,
    `comment` MEDIUMTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uniform_inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uniform_type_id` TEXT NOT NULL,
    `uniform_size_id` TEXT NOT NULL,
    `qty` INTEGER NOT NULL,
    `gender` VARCHAR(255) NOT NULL,
    `date` DATETIME(0) NOT NULL,
    `user` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uniform_issued` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfid` TEXT NOT NULL,
    `releasedby` TEXT NOT NULL,
    `uniform_type_id` VARCHAR(255) NOT NULL,
    `uniform_size_id` VARCHAR(255) NOT NULL,
    `date` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uniform_sizes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `size` TEXT NOT NULL,
    `created_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uniform_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfid` BIGINT NOT NULL,
    `fname` MEDIUMTEXT NOT NULL,
    `mname` MEDIUMTEXT NOT NULL,
    `lname` MEDIUMTEXT NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `gender` TEXT NOT NULL,
    `position` MEDIUMTEXT NOT NULL,
    `grade` TEXT NOT NULL,
    `section` TEXT NOT NULL,
    `dob` DATE NOT NULL,
    `email` MEDIUMTEXT NOT NULL,
    `mobile` MEDIUMTEXT NOT NULL,
    `vacchist` MEDIUMTEXT NOT NULL,
    `photo` MEDIUMTEXT NOT NULL,
    `manager` TEXT NOT NULL,
    `isactive` INTEGER NOT NULL,
    `is_situation` VARCHAR(255) NOT NULL,
    `username` TEXT NOT NULL,
    `password` TEXT NOT NULL,
    `level` INTEGER NOT NULL,
    `status` INTEGER NOT NULL,
    `prevsch` TEXT NOT NULL,
    `prevschcountry` TEXT NOT NULL,
    `lrn` TEXT NOT NULL,
    `uniqid` TEXT NOT NULL,
    `tf` TEXT NOT NULL,
    `country` TEXT NOT NULL,
    `nationality` TEXT NOT NULL,
    `nationalities` VARCHAR(255) NOT NULL,
    `guardianname` TEXT NOT NULL,
    `guardianemail` TEXT NOT NULL,
    `guardianphone` TEXT NOT NULL,
    `referral` TEXT NOT NULL,
    `apptype` TEXT NOT NULL,
    `sy` TEXT NOT NULL,
    `strand` TEXT NOT NULL,
    `religion` TEXT NOT NULL,
    `visa` TEXT NOT NULL,
    `earlybird` INTEGER NOT NULL,
    `modelrelease` INTEGER NOT NULL,
    `feepolicy` INTEGER NOT NULL,
    `refund` INTEGER NOT NULL,
    `tos` INTEGER NOT NULL,
    `empno` TEXT NOT NULL,
    `isESL` INTEGER NOT NULL,
    `house` VARCHAR(255) NOT NULL,
    `isofficial` INTEGER NOT NULL,
    `isEnrolledInAfterSchool` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user22` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfid` BIGINT NOT NULL,
    `fname` MEDIUMTEXT NOT NULL,
    `mname` MEDIUMTEXT NOT NULL,
    `lname` MEDIUMTEXT NOT NULL,
    `gender` TEXT NOT NULL,
    `position` MEDIUMTEXT NOT NULL,
    `grade` TEXT NOT NULL,
    `section` TEXT NOT NULL,
    `dob` DATE NOT NULL,
    `email` MEDIUMTEXT NOT NULL,
    `mobile` MEDIUMTEXT NOT NULL,
    `vacchist` MEDIUMTEXT NOT NULL,
    `photo` MEDIUMTEXT NOT NULL,
    `manager` TEXT NOT NULL,
    `isactive` INTEGER NOT NULL,
    `username` TEXT NOT NULL,
    `password` TEXT NOT NULL,
    `level` INTEGER NOT NULL,
    `status` INTEGER NOT NULL,
    `prevsch` TEXT NOT NULL,
    `prevschcountry` TEXT NOT NULL,
    `lrn` TEXT NOT NULL,
    `uniqid` TEXT NOT NULL,
    `tf` TEXT NOT NULL,
    `country` TEXT NOT NULL,
    `nationality` TEXT NOT NULL,
    `guardianname` TEXT NOT NULL,
    `guardianemail` TEXT NOT NULL,
    `guardianphone` TEXT NOT NULL,
    `referral` TEXT NOT NULL,
    `apptype` TEXT NOT NULL,
    `sy` TEXT NOT NULL,
    `strand` TEXT NOT NULL,
    `visa` TEXT NOT NULL,
    `earlybird` INTEGER NOT NULL,
    `modelrelease` INTEGER NOT NULL,
    `feepolicy` INTEGER NOT NULL,
    `refund` INTEGER NOT NULL,
    `tos` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users24` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfid` BIGINT NOT NULL,
    `fname` MEDIUMTEXT NOT NULL,
    `mname` MEDIUMTEXT NOT NULL,
    `lname` MEDIUMTEXT NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `gender` TEXT NOT NULL,
    `position` MEDIUMTEXT NOT NULL,
    `grade` TEXT NOT NULL,
    `section` TEXT NOT NULL,
    `dob` DATE NOT NULL,
    `email` MEDIUMTEXT NOT NULL,
    `mobile` MEDIUMTEXT NOT NULL,
    `vacchist` MEDIUMTEXT NOT NULL,
    `photo` MEDIUMTEXT NOT NULL,
    `manager` TEXT NOT NULL,
    `isactive` INTEGER NOT NULL,
    `is_situation` VARCHAR(255) NOT NULL,
    `username` TEXT NOT NULL,
    `password` TEXT NOT NULL,
    `level` INTEGER NOT NULL,
    `status` INTEGER NOT NULL,
    `prevsch` TEXT NOT NULL,
    `prevschcountry` TEXT NOT NULL,
    `lrn` TEXT NOT NULL,
    `uniqid` TEXT NOT NULL,
    `tf` TEXT NOT NULL,
    `country` TEXT NOT NULL,
    `nationality` TEXT NOT NULL,
    `nationalities` VARCHAR(255) NOT NULL,
    `religion` TEXT NOT NULL,
    `guardianname` TEXT NOT NULL,
    `guardianemail` TEXT NOT NULL,
    `guardianphone` TEXT NOT NULL,
    `referral` TEXT NOT NULL,
    `apptype` TEXT NOT NULL,
    `sy` TEXT NOT NULL,
    `strand` TEXT NOT NULL,
    `visa` TEXT NOT NULL,
    `earlybird` INTEGER NOT NULL,
    `modelrelease` INTEGER NOT NULL,
    `feepolicy` INTEGER NOT NULL,
    `refund` INTEGER NOT NULL,
    `tos` INTEGER NOT NULL,
    `empno` TEXT NOT NULL,
    `isESL` INTEGER NOT NULL,
    `house` TEXT NOT NULL,
    `isofficial` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visitorlog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` TEXT NOT NULL,
    `rfid` TEXT NOT NULL,
    `comment` TEXT NOT NULL,
    `registerdate` DATETIME(0) NOT NULL,
    `status` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wispay` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `debit` DECIMAL(10, 2) NOT NULL,
    `credit` DECIMAL(10, 2) NOT NULL,
    `rfid` BIGINT NOT NULL,
    `empid` TEXT NOT NULL,
    `username` VARCHAR(255) NOT NULL,
    `refcode` TEXT NOT NULL,
    `transdate` DATETIME(0) NOT NULL,
    `processedby` TEXT NOT NULL,
    `product_type` VARCHAR(255) NOT NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `quantity` FLOAT NOT NULL,
    `isAfterSchoolPayment` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `activitysession` ADD CONSTRAINT `ActivitySession_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `afterschoolactivity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `Attendance_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `activitysession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `Attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrolledactivity` ADD CONSTRAINT `EnrolledActivity_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `afterschoolactivity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrolledactivity` ADD CONSTRAINT `EnrolledActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
