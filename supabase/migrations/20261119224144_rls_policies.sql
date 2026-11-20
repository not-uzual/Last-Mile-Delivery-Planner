-- 1. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policy: Anyone logged in can read profiles
CREATE POLICY "Profiles are viewable by authenticated users" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- 3. Allow the Admin full access to manage the team
CREATE POLICY "Admins can insert profiles" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK ( (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin' );

CREATE POLICY "Admins can update profiles" 
ON profiles FOR UPDATE 
TO authenticated 
USING ( (SELECT app_role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- 4. Baseline Read Policies for the rest of the app
CREATE POLICY "Authenticated users can read leave_records" ON leave_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read order_items" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read deliveries" ON deliveries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert/update customers" ON customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert/update orders" ON orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert/update order_items" ON order_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert/update deliveries" ON deliveries FOR ALL TO authenticated USING (true);

-- 5. Leave: everyone reads (ops plans with it); writes depend on role.
--    crew / ops: request a PENDING day for themselves, and withdraw it while it is still pending
--    admin:      approve or reject a pending request; the decision is final (no edit, no delete)
CREATE POLICY "Crew and ops request their own leave" ON leave_records
FOR INSERT TO authenticated
WITH CHECK (
    current_app_role() IN ('ops', 'crew')
    AND profile_id = auth.uid()
    AND status = 'pending'
    AND decided_by IS NULL AND decided_at IS NULL
);

CREATE POLICY "Admin decides pending leave" ON leave_records
FOR UPDATE TO authenticated
USING (current_app_role() = 'admin' AND status = 'pending')
WITH CHECK (current_app_role() = 'admin' AND status IN ('approved', 'rejected') AND decided_by = auth.uid());

CREATE POLICY "Owner withdraws pending leave" ON leave_records
FOR DELETE TO authenticated
USING (profile_id = auth.uid() AND status = 'pending');
