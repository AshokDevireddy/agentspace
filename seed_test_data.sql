-- ============================================================================
-- SEED TEST DATA SCRIPT
-- This script creates test data for AgentSpace platform including:
-- - Products (for various carriers)
-- - Agent hierarchy (20-30 agents)
-- - Clients (50-100)
-- - Deals (300+) with varied dates over the last year
-- ============================================================================

-- Set the agency ID (AgentSpace)
DO $$
DECLARE
    v_agency_id uuid;

    -- Carrier IDs (fetched from existing carriers table)
    v_carrier_north_american uuid;
    v_carrier_aetna uuid;
    v_carrier_trinity uuid;
    v_carrier_aflac uuid;
    v_carrier_liberty uuid;
    v_carrier_transamerica uuid;
    v_carrier_mutual_omaha uuid;
    v_carrier_kcl uuid;
    v_carrier_americo uuid;
    v_carrier_sbli uuid;

    -- Product IDs (not needed - products are created and randomly selected later)

    -- Top level agents (Regional Managers) - you'll manually set their upline_id
    v_agent_rm1 uuid;
    v_agent_rm2 uuid;
    v_agent_rm3 uuid;

    -- Mid-level agents (Team Leads)
    v_agent_tl1 uuid;
    v_agent_tl2 uuid;
    v_agent_tl3 uuid;
    v_agent_tl4 uuid;
    v_agent_tl5 uuid;

    -- Regular agents
    v_agent_ids uuid[];
    v_agent_id uuid;

    -- Clients
    v_client_ids uuid[];
    v_client_id uuid;

    -- Counter variables
    i integer;
    j integer;
    deal_date date;
    random_carrier uuid;
    random_product uuid;
    random_agent uuid;
    random_client uuid;

BEGIN
    RAISE NOTICE 'Starting test data creation...';

    -- ========================================================================
    -- 0. FETCH AGENCY AND CARRIER IDs FROM DATABASE
    -- ========================================================================
    RAISE NOTICE 'Fetching agency and carrier IDs...';

    -- Get AgentSpace agency ID
    SELECT id INTO v_agency_id FROM agencies WHERE code = 'agentspace' LIMIT 1;
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'AgentSpace agency not found! Please check your agencies table.';
    END IF;

    -- Get carrier IDs by name (LIMIT 1 to handle any duplicates)
    SELECT id INTO v_carrier_north_american FROM carriers WHERE name = 'North American Life' LIMIT 1;
    SELECT id INTO v_carrier_aetna FROM carriers WHERE name = 'Aetna' LIMIT 1;
    SELECT id INTO v_carrier_trinity FROM carriers WHERE name = 'Trinity Life / Family Benefit Life' LIMIT 1;
    SELECT id INTO v_carrier_aflac FROM carriers WHERE name = 'Aflac' LIMIT 1;
    SELECT id INTO v_carrier_liberty FROM carriers WHERE name = 'Liberty Bankers Life (LBL)' LIMIT 1;
    SELECT id INTO v_carrier_transamerica FROM carriers WHERE name = 'Transamerica' LIMIT 1;
    SELECT id INTO v_carrier_mutual_omaha FROM carriers WHERE name = 'Mutual of Omaha' LIMIT 1;
    SELECT id INTO v_carrier_kcl FROM carriers WHERE name = 'Kansas City Life (KCL)' LIMIT 1;
    SELECT id INTO v_carrier_americo FROM carriers WHERE name = 'Americo' LIMIT 1;
    SELECT id INTO v_carrier_sbli FROM carriers WHERE name = 'SBLI' LIMIT 1;

    -- Verify all carriers were found
    IF v_carrier_north_american IS NULL OR v_carrier_aetna IS NULL OR
       v_carrier_trinity IS NULL OR v_carrier_aflac IS NULL OR
       v_carrier_liberty IS NULL OR v_carrier_transamerica IS NULL OR
       v_carrier_mutual_omaha IS NULL OR v_carrier_kcl IS NULL OR
       v_carrier_americo IS NULL OR v_carrier_sbli IS NULL THEN
        RAISE EXCEPTION 'One or more carriers not found! Please check your carriers table.';
    END IF;

    RAISE NOTICE '✓ Agency and carriers found';

    -- ========================================================================
    -- 1. CREATE PRODUCTS
    -- ========================================================================
    RAISE NOTICE 'Creating products...';

    -- North American Life Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_north_american, 'Term Life Insurance', 'NAL-TERM-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_north_american, 'Whole Life Insurance', 'NAL-WHOLE-001', v_agency_id, true);

    -- Aetna Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_aetna, 'Medicare Supplement', 'AETNA-MED-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_aetna, 'Health Insurance Plan', 'AETNA-HEALTH-001', v_agency_id, true);

    -- Trinity Life Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_trinity, 'Final Expense', 'TRIN-FE-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_trinity, 'Family Benefit Life', 'TRIN-FAM-001', v_agency_id, true);

    -- Aflac Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_aflac, 'Accident Insurance', 'AFLAC-ACC-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_aflac, 'Disability Insurance', 'AFLAC-DIS-001', v_agency_id, true);

    -- Liberty Bankers Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_liberty, 'Whole Life', 'LBL-WHOLE-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_liberty, 'Final Expense', 'LBL-FE-001', v_agency_id, true);

    -- Transamerica Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_transamerica, 'Universal Life', 'TRANS-UL-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_transamerica, 'Term Life', 'TRANS-TERM-001', v_agency_id, true);

    -- Mutual of Omaha Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_mutual_omaha, 'Final Expense', 'MOO-FE-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_mutual_omaha, 'Medicare Supplement', 'MOO-MED-001', v_agency_id, true);

    -- Kansas City Life Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_kcl, 'Whole Life', 'KCL-WHOLE-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_kcl, 'Term Life', 'KCL-TERM-001', v_agency_id, true);

    -- Americo Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_americo, 'Final Expense', 'AMER-FE-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_americo, 'Indexed Universal Life', 'AMER-IUL-001', v_agency_id, true);

    -- SBLI Products
    INSERT INTO products (id, carrier_id, name, product_code, agency_id, is_active)
    VALUES
        (gen_random_uuid(), v_carrier_sbli, 'Term Life', 'SBLI-TERM-001', v_agency_id, true),
        (gen_random_uuid(), v_carrier_sbli, 'Whole Life', 'SBLI-WHOLE-001', v_agency_id, true);

    RAISE NOTICE 'Products created successfully';

    -- ========================================================================
    -- 2. CREATE AGENT HIERARCHY
    -- ========================================================================
    RAISE NOTICE 'Creating agent hierarchy...';

    -- Top Level: Regional Manager 1 (reports to your account - the root of test hierarchy)
    INSERT INTO users (id, email, first_name, last_name, phone_number, role, upline_id, is_admin, annual_goal, agency_id, status, perm_level, is_active)
    VALUES
        (gen_random_uuid(), 'test.rm1@agentspace.test', 'Michael', 'Rodriguez', '555-0101', 'agent', 'c3250f05-972c-4b5d-bbf6-91ac00ff5c97', true, 500000, v_agency_id, 'active', 'admin', true);

    -- Get RM1 ID
    SELECT id INTO v_agent_rm1 FROM users WHERE email = 'test.rm1@agentspace.test' LIMIT 1;

    RAISE NOTICE 'Top Regional Manager created (reports to you). ID: %', v_agent_rm1;

    -- Second Level: Regional Managers 2 and 3 (report to RM1)
    INSERT INTO users (id, email, first_name, last_name, phone_number, role, upline_id, is_admin, annual_goal, agency_id, status, perm_level, is_active)
    VALUES
        (gen_random_uuid(), 'test.rm2@agentspace.test', 'Sarah', 'Thompson', '555-0102', 'agent', v_agent_rm1, true, 500000, v_agency_id, 'active', 'admin', true),
        (gen_random_uuid(), 'test.rm3@agentspace.test', 'David', 'Chen', '555-0103', 'agent', v_agent_rm1, true, 500000, v_agency_id, 'active', 'admin', true);

    -- Get RM2 and RM3 IDs
    SELECT id INTO v_agent_rm2 FROM users WHERE email = 'test.rm2@agentspace.test' LIMIT 1;
    SELECT id INTO v_agent_rm3 FROM users WHERE email = 'test.rm3@agentspace.test' LIMIT 1;

    RAISE NOTICE 'Sub-Regional Managers created (report to RM1). IDs: %, %', v_agent_rm2, v_agent_rm3;

    -- Mid Level: Team Leads (5 agents reporting to Regional Managers)
    INSERT INTO users (email, first_name, last_name, phone_number, role, upline_id, annual_goal, agency_id, status, perm_level, is_active)
    VALUES
        ('test.tl1@agentspace.test', 'Jennifer', 'Williams', '555-0201', 'agent', v_agent_rm1, 300000, v_agency_id, 'active', 'manager', true),
        ('test.tl2@agentspace.test', 'Robert', 'Johnson', '555-0202', 'agent', v_agent_rm1, 300000, v_agency_id, 'active', 'manager', true),
        ('test.tl3@agentspace.test', 'Emily', 'Davis', '555-0203', 'agent', v_agent_rm2, 300000, v_agency_id, 'active', 'manager', true),
        ('test.tl4@agentspace.test', 'James', 'Martinez', '555-0204', 'agent', v_agent_rm2, 300000, v_agency_id, 'active', 'manager', true),
        ('test.tl5@agentspace.test', 'Amanda', 'Garcia', '555-0205', 'agent', v_agent_rm3, 300000, v_agency_id, 'active', 'manager', true);

    -- Get Team Lead IDs
    SELECT id INTO v_agent_tl1 FROM users WHERE email = 'test.tl1@agentspace.test' LIMIT 1;
    SELECT id INTO v_agent_tl2 FROM users WHERE email = 'test.tl2@agentspace.test' LIMIT 1;
    SELECT id INTO v_agent_tl3 FROM users WHERE email = 'test.tl3@agentspace.test' LIMIT 1;
    SELECT id INTO v_agent_tl4 FROM users WHERE email = 'test.tl4@agentspace.test' LIMIT 1;
    SELECT id INTO v_agent_tl5 FROM users WHERE email = 'test.tl5@agentspace.test' LIMIT 1;

    -- Regular Agents (22 agents reporting to Team Leads)
    INSERT INTO users (email, first_name, last_name, phone_number, role, upline_id, annual_goal, agency_id, status, is_active)
    VALUES
        ('test.agent1@agentspace.test', 'Christopher', 'Anderson', '555-0301', 'agent', v_agent_tl1, 150000, v_agency_id, 'active', true),
        ('test.agent2@agentspace.test', 'Jessica', 'Taylor', '555-0302', 'agent', v_agent_tl1, 150000, v_agency_id, 'active', true),
        ('test.agent3@agentspace.test', 'Matthew', 'Thomas', '555-0303', 'agent', v_agent_tl1, 150000, v_agency_id, 'active', true),
        ('test.agent4@agentspace.test', 'Ashley', 'Jackson', '555-0304', 'agent', v_agent_tl1, 150000, v_agency_id, 'active', true),
        ('test.agent5@agentspace.test', 'Daniel', 'White', '555-0305', 'agent', v_agent_tl2, 150000, v_agency_id, 'active', true),
        ('test.agent6@agentspace.test', 'Lauren', 'Harris', '555-0306', 'agent', v_agent_tl2, 150000, v_agency_id, 'active', true),
        ('test.agent7@agentspace.test', 'Joshua', 'Martin', '555-0307', 'agent', v_agent_tl2, 150000, v_agency_id, 'active', true),
        ('test.agent8@agentspace.test', 'Brittany', 'Thompson', '555-0308', 'agent', v_agent_tl2, 150000, v_agency_id, 'active', true),
        ('test.agent9@agentspace.test', 'Andrew', 'Martinez', '555-0309', 'agent', v_agent_tl3, 150000, v_agency_id, 'active', true),
        ('test.agent10@agentspace.test', 'Stephanie', 'Robinson', '555-0310', 'agent', v_agent_tl3, 150000, v_agency_id, 'active', true),
        ('test.agent11@agentspace.test', 'Ryan', 'Clark', '555-0311', 'agent', v_agent_tl3, 150000, v_agency_id, 'active', true),
        ('test.agent12@agentspace.test', 'Nicole', 'Rodriguez', '555-0312', 'agent', v_agent_tl3, 150000, v_agency_id, 'active', true),
        ('test.agent13@agentspace.test', 'Brandon', 'Lewis', '555-0313', 'agent', v_agent_tl4, 150000, v_agency_id, 'active', true),
        ('test.agent14@agentspace.test', 'Megan', 'Lee', '555-0314', 'agent', v_agent_tl4, 150000, v_agency_id, 'active', true),
        ('test.agent15@agentspace.test', 'Justin', 'Walker', '555-0315', 'agent', v_agent_tl4, 150000, v_agency_id, 'active', true),
        ('test.agent16@agentspace.test', 'Rachel', 'Hall', '555-0316', 'agent', v_agent_tl4, 150000, v_agency_id, 'active', true),
        ('test.agent17@agentspace.test', 'Kevin', 'Allen', '555-0317', 'agent', v_agent_tl5, 150000, v_agency_id, 'active', true),
        ('test.agent18@agentspace.test', 'Samantha', 'Young', '555-0318', 'agent', v_agent_tl5, 150000, v_agency_id, 'active', true),
        ('test.agent19@agentspace.test', 'Tyler', 'King', '555-0319', 'agent', v_agent_tl5, 150000, v_agency_id, 'active', true),
        ('test.agent20@agentspace.test', 'Melissa', 'Wright', '555-0320', 'agent', v_agent_tl5, 150000, v_agency_id, 'active', true),
        ('test.agent21@agentspace.test', 'Eric', 'Lopez', '555-0321', 'agent', v_agent_tl5, 150000, v_agency_id, 'active', true),
        ('test.agent22@agentspace.test', 'Amber', 'Hill', '555-0322', 'agent', v_agent_tl5, 150000, v_agency_id, 'active', true);

    -- Store all agent IDs for deal creation
    SELECT ARRAY_AGG(id) INTO v_agent_ids FROM users WHERE email LIKE 'test.%@agentspace.test' AND role = 'agent';

    RAISE NOTICE 'Created % agents total', array_length(v_agent_ids, 1);

    -- ========================================================================
    -- 3. CREATE CLIENTS
    -- ========================================================================
    RAISE NOTICE 'Creating clients...';

    INSERT INTO users (email, first_name, last_name, phone_number, role, agency_id, status, is_active)
    VALUES
        ('test.client1@example.com', 'John', 'Smith', '555-1001', 'client', v_agency_id, 'active', true),
        ('test.client2@example.com', 'Mary', 'Johnson', '555-1002', 'client', v_agency_id, 'active', true),
        ('test.client3@example.com', 'Patricia', 'Williams', '555-1003', 'client', v_agency_id, 'active', true),
        ('test.client4@example.com', 'Linda', 'Brown', '555-1004', 'client', v_agency_id, 'active', true),
        ('test.client5@example.com', 'Barbara', 'Jones', '555-1005', 'client', v_agency_id, 'active', true),
        ('test.client6@example.com', 'Elizabeth', 'Garcia', '555-1006', 'client', v_agency_id, 'active', true),
        ('test.client7@example.com', 'Susan', 'Miller', '555-1007', 'client', v_agency_id, 'active', true),
        ('test.client8@example.com', 'Margaret', 'Davis', '555-1008', 'client', v_agency_id, 'active', true),
        ('test.client9@example.com', 'Dorothy', 'Rodriguez', '555-1009', 'client', v_agency_id, 'active', true),
        ('test.client10@example.com', 'Lisa', 'Martinez', '555-1010', 'client', v_agency_id, 'active', true),
        ('test.client11@example.com', 'Nancy', 'Hernandez', '555-1011', 'client', v_agency_id, 'active', true),
        ('test.client12@example.com', 'Karen', 'Lopez', '555-1012', 'client', v_agency_id, 'active', true),
        ('test.client13@example.com', 'Betty', 'Gonzalez', '555-1013', 'client', v_agency_id, 'active', true),
        ('test.client14@example.com', 'Helen', 'Wilson', '555-1014', 'client', v_agency_id, 'active', true),
        ('test.client15@example.com', 'Sandra', 'Anderson', '555-1015', 'client', v_agency_id, 'active', true),
        ('test.client16@example.com', 'Donna', 'Thomas', '555-1016', 'client', v_agency_id, 'active', true),
        ('test.client17@example.com', 'Carol', 'Taylor', '555-1017', 'client', v_agency_id, 'active', true),
        ('test.client18@example.com', 'Ruth', 'Moore', '555-1018', 'client', v_agency_id, 'active', true),
        ('test.client19@example.com', 'Sharon', 'Jackson', '555-1019', 'client', v_agency_id, 'active', true),
        ('test.client20@example.com', 'Michelle', 'Martin', '555-1020', 'client', v_agency_id, 'active', true),
        ('test.client21@example.com', 'Laura', 'Lee', '555-1021', 'client', v_agency_id, 'active', true),
        ('test.client22@example.com', 'Sarah', 'Perez', '555-1022', 'client', v_agency_id, 'active', true),
        ('test.client23@example.com', 'Kimberly', 'White', '555-1023', 'client', v_agency_id, 'active', true),
        ('test.client24@example.com', 'Deborah', 'Harris', '555-1024', 'client', v_agency_id, 'active', true),
        ('test.client25@example.com', 'Jessica', 'Sanchez', '555-1025', 'client', v_agency_id, 'active', true),
        ('test.client26@example.com', 'Shirley', 'Clark', '555-1026', 'client', v_agency_id, 'active', true),
        ('test.client27@example.com', 'Cynthia', 'Ramirez', '555-1027', 'client', v_agency_id, 'active', true),
        ('test.client28@example.com', 'Angela', 'Lewis', '555-1028', 'client', v_agency_id, 'active', true),
        ('test.client29@example.com', 'Melissa', 'Robinson', '555-1029', 'client', v_agency_id, 'active', true),
        ('test.client30@example.com', 'Brenda', 'Walker', '555-1030', 'client', v_agency_id, 'active', true),
        ('test.client31@example.com', 'Amy', 'Young', '555-1031', 'client', v_agency_id, 'active', true),
        ('test.client32@example.com', 'Anna', 'Allen', '555-1032', 'client', v_agency_id, 'active', true),
        ('test.client33@example.com', 'Rebecca', 'King', '555-1033', 'client', v_agency_id, 'active', true),
        ('test.client34@example.com', 'Virginia', 'Wright', '555-1034', 'client', v_agency_id, 'active', true),
        ('test.client35@example.com', 'Kathleen', 'Scott', '555-1035', 'client', v_agency_id, 'active', true),
        ('test.client36@example.com', 'Pamela', 'Torres', '555-1036', 'client', v_agency_id, 'active', true),
        ('test.client37@example.com', 'Martha', 'Nguyen', '555-1037', 'client', v_agency_id, 'active', true),
        ('test.client38@example.com', 'Debra', 'Hill', '555-1038', 'client', v_agency_id, 'active', true),
        ('test.client39@example.com', 'Amanda', 'Flores', '555-1039', 'client', v_agency_id, 'active', true),
        ('test.client40@example.com', 'Stephanie', 'Green', '555-1040', 'client', v_agency_id, 'active', true),
        ('test.client41@example.com', 'Carolyn', 'Adams', '555-1041', 'client', v_agency_id, 'active', true),
        ('test.client42@example.com', 'Christine', 'Nelson', '555-1042', 'client', v_agency_id, 'active', true),
        ('test.client43@example.com', 'Marie', 'Baker', '555-1043', 'client', v_agency_id, 'active', true),
        ('test.client44@example.com', 'Janet', 'Hall', '555-1044', 'client', v_agency_id, 'active', true),
        ('test.client45@example.com', 'Catherine', 'Rivera', '555-1045', 'client', v_agency_id, 'active', true),
        ('test.client46@example.com', 'Frances', 'Campbell', '555-1046', 'client', v_agency_id, 'active', true),
        ('test.client47@example.com', 'Ann', 'Mitchell', '555-1047', 'client', v_agency_id, 'active', true),
        ('test.client48@example.com', 'Joyce', 'Carter', '555-1048', 'client', v_agency_id, 'active', true),
        ('test.client49@example.com', 'Diane', 'Roberts', '555-1049', 'client', v_agency_id, 'active', true),
        ('test.client50@example.com', 'Alice', 'Gomez', '555-1050', 'client', v_agency_id, 'active', true),
        ('test.client51@example.com', 'Julie', 'Phillips', '555-1051', 'client', v_agency_id, 'active', true),
        ('test.client52@example.com', 'Heather', 'Evans', '555-1052', 'client', v_agency_id, 'active', true),
        ('test.client53@example.com', 'Teresa', 'Turner', '555-1053', 'client', v_agency_id, 'active', true),
        ('test.client54@example.com', 'Doris', 'Diaz', '555-1054', 'client', v_agency_id, 'active', true),
        ('test.client55@example.com', 'Gloria', 'Parker', '555-1055', 'client', v_agency_id, 'active', true),
        ('test.client56@example.com', 'Evelyn', 'Cruz', '555-1056', 'client', v_agency_id, 'active', true),
        ('test.client57@example.com', 'Jean', 'Edwards', '555-1057', 'client', v_agency_id, 'active', true),
        ('test.client58@example.com', 'Cheryl', 'Collins', '555-1058', 'client', v_agency_id, 'active', true),
        ('test.client59@example.com', 'Mildred', 'Reyes', '555-1059', 'client', v_agency_id, 'active', true),
        ('test.client60@example.com', 'Katherine', 'Stewart', '555-1060', 'client', v_agency_id, 'active', true),
        ('test.client61@example.com', 'Joan', 'Morris', '555-1061', 'client', v_agency_id, 'active', true),
        ('test.client62@example.com', 'Ashley', 'Morales', '555-1062', 'client', v_agency_id, 'active', true),
        ('test.client63@example.com', 'Judith', 'Murphy', '555-1063', 'client', v_agency_id, 'active', true),
        ('test.client64@example.com', 'Rose', 'Cook', '555-1064', 'client', v_agency_id, 'active', true),
        ('test.client65@example.com', 'Janice', 'Rogers', '555-1065', 'client', v_agency_id, 'active', true),
        ('test.client66@example.com', 'Kelly', 'Morgan', '555-1066', 'client', v_agency_id, 'active', true),
        ('test.client67@example.com', 'Nicole', 'Peterson', '555-1067', 'client', v_agency_id, 'active', true),
        ('test.client68@example.com', 'Judy', 'Cooper', '555-1068', 'client', v_agency_id, 'active', true),
        ('test.client69@example.com', 'Christina', 'Reed', '555-1069', 'client', v_agency_id, 'active', true),
        ('test.client70@example.com', 'Kathy', 'Bailey', '555-1070', 'client', v_agency_id, 'active', true),
        ('test.client71@example.com', 'Theresa', 'Bell', '555-1071', 'client', v_agency_id, 'active', true),
        ('test.client72@example.com', 'Beverly', 'Howard', '555-1072', 'client', v_agency_id, 'active', true),
        ('test.client73@example.com', 'Denise', 'Ward', '555-1073', 'client', v_agency_id, 'active', true),
        ('test.client74@example.com', 'Tammy', 'Cox', '555-1074', 'client', v_agency_id, 'active', true),
        ('test.client75@example.com', 'Irene', 'Richardson', '555-1075', 'client', v_agency_id, 'active', true),
        ('test.client76@example.com', 'Jane', 'Wood', '555-1076', 'client', v_agency_id, 'active', true),
        ('test.client77@example.com', 'Lori', 'Watson', '555-1077', 'client', v_agency_id, 'active', true),
        ('test.client78@example.com', 'Rachel', 'Brooks', '555-1078', 'client', v_agency_id, 'active', true),
        ('test.client79@example.com', 'Marilyn', 'Kelly', '555-1079', 'client', v_agency_id, 'active', true),
        ('test.client80@example.com', 'Andrea', 'Sanders', '555-1080', 'client', v_agency_id, 'active', true);

    -- Store all client IDs
    SELECT ARRAY_AGG(id) INTO v_client_ids FROM users WHERE email LIKE 'test.client%@example.com';

    RAISE NOTICE 'Created % clients', array_length(v_client_ids, 1);

    -- ========================================================================
    -- 4. CREATE DEALS (300+ deals over last year)
    -- ========================================================================
    RAISE NOTICE 'Creating deals...';

    -- Create 350 deals with varied dates, statuses, and values
    FOR i IN 1..350 LOOP
        -- Random date in the last 365 days
        deal_date := CURRENT_DATE - (floor(random() * 365)::int);

        -- Random agent
        random_agent := v_agent_ids[1 + floor(random() * array_length(v_agent_ids, 1))::int];

        -- Random client (50% chance of having a client_id)
        IF random() > 0.5 AND array_length(v_client_ids, 1) > 0 THEN
            random_client := v_client_ids[1 + floor(random() * array_length(v_client_ids, 1))::int];
        ELSE
            random_client := NULL;
        END IF;

        -- Randomly select carrier and product
        CASE floor(random() * 10)::int
            WHEN 0 THEN
                random_carrier := v_carrier_north_american;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_north_american ORDER BY random() LIMIT 1;
            WHEN 1 THEN
                random_carrier := v_carrier_aetna;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_aetna ORDER BY random() LIMIT 1;
            WHEN 2 THEN
                random_carrier := v_carrier_trinity;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_trinity ORDER BY random() LIMIT 1;
            WHEN 3 THEN
                random_carrier := v_carrier_aflac;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_aflac ORDER BY random() LIMIT 1;
            WHEN 4 THEN
                random_carrier := v_carrier_liberty;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_liberty ORDER BY random() LIMIT 1;
            WHEN 5 THEN
                random_carrier := v_carrier_transamerica;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_transamerica ORDER BY random() LIMIT 1;
            WHEN 6 THEN
                random_carrier := v_carrier_mutual_omaha;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_mutual_omaha ORDER BY random() LIMIT 1;
            WHEN 7 THEN
                random_carrier := v_carrier_kcl;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_kcl ORDER BY random() LIMIT 1;
            WHEN 8 THEN
                random_carrier := v_carrier_americo;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_americo ORDER BY random() LIMIT 1;
            ELSE
                random_carrier := v_carrier_sbli;
                SELECT id INTO random_product FROM products WHERE carrier_id = v_carrier_sbli ORDER BY random() LIMIT 1;
        END CASE;

        INSERT INTO deals (
            agent_id,
            carrier_id,
            product_id,
            client_name,
            client_phone,
            client_email,
            client_id,
            policy_number,
            application_number,
            monthly_premium,
            annual_premium,
            policy_effective_date,
            status,
            lead_source,
            billing_cycle,
            payment_method,
            state,
            agency_id,
            created_at,
            updated_at
        )
        VALUES (
            random_agent,
            random_carrier,
            random_product,
            'Test Client ' || i,
            '555-' || LPAD(i::text, 4, '0'),
            'testclient' || i || '@test.com',
            random_client,
            'POL-TEST-' || LPAD(i::text, 6, '0'),
            'APP-TEST-' || LPAD(i::text, 6, '0'),
            50 + (random() * 450)::numeric(10,2), -- $50-$500/month
            (50 + (random() * 450)::numeric(10,2)) * 12, -- Annual = monthly * 12
            deal_date,
            CASE
                WHEN random() < 0.7 THEN 'issued'
                WHEN random() < 0.85 THEN 'submitted'
                WHEN random() < 0.95 THEN 'in_progress'
                ELSE 'draft'
            END,
            CASE floor(random() * 5)::int
                WHEN 0 THEN 'Referral'
                WHEN 1 THEN 'Online Lead'
                WHEN 2 THEN 'Facebook'
                WHEN 3 THEN 'Cold Call'
                ELSE 'Walk-in'
            END,
            CASE floor(random() * 4)::int
                WHEN 0 THEN 'monthly'
                WHEN 1 THEN 'quarterly'
                WHEN 2 THEN 'semi-annually'
                ELSE 'annually'
            END,
            CASE floor(random() * 3)::int
                WHEN 0 THEN 'bank_draft'
                WHEN 1 THEN 'credit_card'
                ELSE 'check'
            END,
            CASE floor(random() * 10)::int
                WHEN 0 THEN 'CA'
                WHEN 1 THEN 'TX'
                WHEN 2 THEN 'FL'
                WHEN 3 THEN 'NY'
                WHEN 4 THEN 'IL'
                WHEN 5 THEN 'PA'
                WHEN 6 THEN 'OH'
                WHEN 7 THEN 'GA'
                WHEN 8 THEN 'NC'
                ELSE 'AZ'
            END,
            v_agency_id,
            deal_date - (floor(random() * 30)::int), -- Created up to 30 days before effective date
            CURRENT_TIMESTAMP
        );

        IF i % 50 = 0 THEN
            RAISE NOTICE 'Created % deals...', i;
        END IF;
    END LOOP;

    RAISE NOTICE '✓ Test data creation complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '  - Products: 20';
    RAISE NOTICE '  - Agents: %', array_length(v_agent_ids, 1);
    RAISE NOTICE '  - Clients: %', array_length(v_client_ids, 1);
    RAISE NOTICE '  - Deals: 350';
    RAISE NOTICE '';
    RAISE NOTICE '🌳 Agent Hierarchy Structure:';
    RAISE NOTICE '  You (c3250f05-972c-4b5d-bbf6-91ac00ff5c97)';
    RAISE NOTICE '   └─ RM1: Michael Rodriguez (%)' , v_agent_rm1;
    RAISE NOTICE '       ├─ RM2: Sarah Thompson (%)' , v_agent_rm2;
    RAISE NOTICE '       ├─ RM3: David Chen (%)' , v_agent_rm3;
    RAISE NOTICE '       └─ 5 Team Leads → 22 Agents';
    RAISE NOTICE '';
    RAISE NOTICE '✅ All test agents are in one complete hierarchy under your account!';
    RAISE NOTICE '✅ Ready to test scoreboard, commissions, and org charts!';

END $$;

