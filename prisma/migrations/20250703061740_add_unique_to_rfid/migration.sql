/*
  Warnings:

  - A unique constraint covering the columns `[rfid]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `user_rfid_key` ON `user`(`rfid`);
