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

CREATE POLICY "Authenticated users can insert/update leave_records" ON leave_records FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert/update customers" ON customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert/update orders" ON orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert/update order_items" ON order_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert/update deliveries" ON deliveries FOR ALL TO authenticated USING (true);
