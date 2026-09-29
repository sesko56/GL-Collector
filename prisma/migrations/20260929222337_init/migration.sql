-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('MYTHIQUE', 'LEGENDAIRE', 'EPIQUE', 'RARE', 'PEU_COMMUNE', 'COMMUNE');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('OUVERTE', 'TERMINEE', 'VENDUE', 'EXPIREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BONUS_BIENVENUE', 'RESERVATION_ENCHERE', 'REMBOURSEMENT_SURENCHERE', 'VENTE_ENCHERE', 'ANNULATION_ENCHERE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('JOUEUR', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verification_expires_at" TIMESTAMP(3),
    "reset_password_token" TEXT,
    "reset_token_expires_at" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'JOUEUR',
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "coins" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_pages" (
    "id" TEXT NOT NULL,
    "fandom_page_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_view_statistics" (
    "id" TEXT NOT NULL,
    "wiki_page_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annual_views" INTEGER NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_view_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "wiki_page_id" TEXT NOT NULL,
    "fandom_page_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMUNE',
    "annual_views" INTEGER NOT NULL DEFAULT 0,
    "rarity_year" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rarity_calculations" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annual_views" INTEGER NOT NULL,
    "percentile_rank" DOUBLE PRECISION NOT NULL,
    "previous_rarity" "Rarity",
    "assigned_rarity" "Rarity" NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rarity_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_ownerships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "serial_number" INTEGER NOT NULL,
    "locked_for_auction" BOOLEAN NOT NULL DEFAULT false,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "booster_opening_id" TEXT,

    CONSTRAINT "card_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booster_inventory" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stored_boosters" INTEGER NOT NULL DEFAULT 10,
    "last_recharge_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booster_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booster_openings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "card_ids_json" TEXT NOT NULL,

    CONSTRAINT "booster_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auctions" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "card_ownership_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "starting_price" INTEGER NOT NULL,
    "current_bid" INTEGER NOT NULL,
    "current_bidder_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'OUVERTE',

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "bidder_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "reference" TEXT NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_pages_fandom_page_id_key" ON "wiki_pages"("fandom_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_pages_title_key" ON "wiki_pages"("title");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_view_statistics_wiki_page_id_year_key" ON "wiki_view_statistics"("wiki_page_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "cards_wiki_page_id_key" ON "cards"("wiki_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "cards_fandom_page_id_key" ON "cards"("fandom_page_id");

-- CreateIndex
CREATE INDEX "rarity_calculations_year_idx" ON "rarity_calculations"("year");

-- CreateIndex
CREATE INDEX "card_ownerships_user_id_card_id_idx" ON "card_ownerships"("user_id", "card_id");

-- CreateIndex
CREATE UNIQUE INDEX "booster_inventory_user_id_key" ON "booster_inventory"("user_id");

-- CreateIndex
CREATE INDEX "auctions_status_end_date_idx" ON "auctions"("status", "end_date");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- AddForeignKey
ALTER TABLE "wiki_view_statistics" ADD CONSTRAINT "wiki_view_statistics_wiki_page_id_fkey" FOREIGN KEY ("wiki_page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_wiki_page_id_fkey" FOREIGN KEY ("wiki_page_id") REFERENCES "wiki_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rarity_calculations" ADD CONSTRAINT "rarity_calculations_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_ownerships" ADD CONSTRAINT "card_ownerships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_ownerships" ADD CONSTRAINT "card_ownerships_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booster_inventory" ADD CONSTRAINT "booster_inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booster_openings" ADD CONSTRAINT "booster_openings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_card_ownership_id_fkey" FOREIGN KEY ("card_ownership_id") REFERENCES "card_ownerships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_current_bidder_id_fkey" FOREIGN KEY ("current_bidder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
