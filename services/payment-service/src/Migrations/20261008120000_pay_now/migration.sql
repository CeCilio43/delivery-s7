-- Payments are no longer charged automatically: the customer pays with "Pay
-- now". A pending payment whose order is cancelled before it was paid is
-- voided with this status.
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';
