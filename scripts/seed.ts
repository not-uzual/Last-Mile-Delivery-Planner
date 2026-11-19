import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function runSeed() {
    console.log('Starting database seed...');

    // 1. Create Users (Auth & Profiles)
    const usersToCreate = [
        { email: 'admin@test.com', name: 'Admin', role: 'admin', crewRole: null, offDay: 0 },
        { email: 'ops@test.com', name: 'Ops', role: 'ops', crewRole: null, offDay: 0 },
        { email: 'driver@test.com', name: 'Driver', role: 'crew', crewRole: 'driver', offDay: 0 },
        { email: 'assembler1@test.com', name: 'Assembler1', role: 'crew', crewRole: 'assembler', offDay: 1 },
        { email: 'assembler2@test.com', name: 'Assembler2', role: 'crew', crewRole: 'assembler', offDay: 1 },
    ];

    for (const u of usersToCreate) {
        // Create auth user (Password is 'pswd123' for testing)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: u.email,
            password: 'pswd123',
            email_confirm: true,
        });

        let userId: string;
        if (authError) {
            const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
            if (usersError) throw usersError;

            const existingUser = usersData.users.find((user) => user.email === u.email);
            if (!existingUser) throw authError;

            userId = existingUser.id;
            console.log(`User ${u.email} already exists. Ensuring profile.`);
        } else {
            userId = authData.user.id;
        }

        const { error: profileError } = await supabase.from('profiles').upsert({
            id: userId,
            full_name: u.name,
            app_role: u.role,
            crew_role: u.crewRole,
            weekly_off_day: u.offDay,
        }, { onConflict: 'id', ignoreDuplicates: true });

        if (profileError) throw profileError;
        console.log(`Ensured profile: ${u.email}`);
    }

    // 2. Create Customers
    console.log('Generating customers...');
    const customers = Array.from({ length: 15 }).map(() => ({
        name: faker.person.fullName(),
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        lat: faker.location.latitude({ max: 51.6, min: 51.4 }),
        lng: faker.location.longitude({ max: 0.2, min: -0.4 }),
        lift_length: faker.number.int({ min: 100, max: 250 }),
        lift_width: faker.number.int({ min: 100, max: 200 }),
        lift_height: faker.number.int({ min: 200, max: 250 }),
        has_staircase_only: faker.datatype.boolean({ probability: 0.2 }),
    }));

    const { data: insertedCustomers, error: customerError } = await supabase
        .from('customers')
        .insert(customers)
        .select();

    if (customerError) throw customerError;

    // 3. Create Orders & Items
    console.log('Generating orders and items...');
    for (const customer of insertedCustomers) {
        // Create 1-2 orders per customer
        const numOrders = faker.number.int({ min: 1, max: 2 });

        for (let i = 0; i < numOrders; i++) {
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    customer_id: customer.id,
                    ready_date: faker.date.soon({ days: 14 }).toISOString().split('T')[0],
                    status: 'unplanned',
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // Create 1-3 items per order
            const numItems = faker.number.int({ min: 1, max: 3 });
            const items = Array.from({ length: numItems }).map(() => ({
                order_id: orderData.id,
                name: faker.commerce.productName(),
                length: faker.number.int({ min: 50, max: 300 }),
                width: faker.number.int({ min: 50, max: 150 }),
                height: faker.number.int({ min: 10, max: 100 }),
                weight: faker.number.int({ min: 5, max: 80 }),
            }));

            await supabase.from('order_items').insert(items);
        }
    }

    console.log('Seed completed successfully!');
}

runSeed().catch(console.error);
