-- ============================================================================
-- CLEANUP TEST DATA SCRIPT
-- This script removes all test data created by seed_test_data.sql
-- Deletes in correct order to respect foreign key constraints:
-- 1. Deals (references users, carriers, products)
-- 2. Users (clients and agents)
-- 3. Products (references carriers)
-- ============================================================================

DO $$
DECLARE
    deals_deleted integer;
    clients_deleted integer;
    agents_deleted integer;
    products_deleted integer;
BEGIN
    RAISE NOTICE 'Starting cleanup of test data...';

    -- ========================================================================
    -- 1. DELETE DEALS (must be first due to foreign keys)
    -- ========================================================================
    RAISE NOTICE 'Deleting test deals...';

    DELETE FROM deals
    WHERE policy_number LIKE 'POL-TEST-%'
       OR application_number LIKE 'APP-TEST-%'
       OR client_email LIKE '%@test.com'
       OR product_id IN (
           SELECT id FROM products
           WHERE product_code LIKE 'NAL-%'
              OR product_code LIKE 'AETNA-%'
              OR product_code LIKE 'TRIN-%'
              OR product_code LIKE 'AFLAC-%'
              OR product_code LIKE 'LBL-%'
              OR product_code LIKE 'TRANS-%'
              OR product_code LIKE 'MOO-%'
              OR product_code LIKE 'KCL-%'
              OR product_code LIKE 'AMER-%'
              OR product_code LIKE 'SBLI-%'
       );

    GET DIAGNOSTICS deals_deleted = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % deals', deals_deleted;

    -- ========================================================================
    -- 2. DELETE CLIENT USERS
    -- ========================================================================
    RAISE NOTICE 'Deleting test clients...';

    DELETE FROM users
    WHERE email LIKE 'test.client%@example.com';

    GET DIAGNOSTICS clients_deleted = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % clients', clients_deleted;

    -- ========================================================================
    -- 3. DELETE AGENT USERS (delete in reverse hierarchy order)
    -- ========================================================================
    RAISE NOTICE 'Deleting test agents...';

    -- Delete regular agents first
    DELETE FROM users
    WHERE email LIKE 'test.agent%@agentspace.test';

    -- Delete team leads
    DELETE FROM users
    WHERE email LIKE 'test.tl%@agentspace.test';

    -- Delete regional managers
    DELETE FROM users
    WHERE email LIKE 'test.rm%@agentspace.test';

    GET DIAGNOSTICS agents_deleted = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % agents', agents_deleted;

    -- ========================================================================
    -- 4. DELETE PRODUCTS
    -- ========================================================================
    RAISE NOTICE 'Deleting test products...';

    DELETE FROM products
    WHERE product_code LIKE 'NAL-%'
       OR product_code LIKE 'AETNA-%'
       OR product_code LIKE 'TRIN-%'
       OR product_code LIKE 'AFLAC-%'
       OR product_code LIKE 'LBL-%'
       OR product_code LIKE 'TRANS-%'
       OR product_code LIKE 'MOO-%'
       OR product_code LIKE 'KCL-%'
       OR product_code LIKE 'AMER-%'
       OR product_code LIKE 'SBLI-%';

    GET DIAGNOSTICS products_deleted = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % products', products_deleted;

    -- ========================================================================
    -- SUMMARY
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '✓ Cleanup complete!';
    RAISE NOTICE '  Summary:';
    RAISE NOTICE '    - Deals deleted: %', deals_deleted;
    RAISE NOTICE '    - Clients deleted: %', clients_deleted;
    RAISE NOTICE '    - Agents deleted: %', agents_deleted;
    RAISE NOTICE '    - Products deleted: %', products_deleted;
    RAISE NOTICE '  Total records deleted: %', deals_deleted + clients_deleted + agents_deleted + products_deleted;

END $$;

