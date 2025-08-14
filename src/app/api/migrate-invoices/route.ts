import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    
    const oldInvoicesCollection = db.collection('invoices');
    const universalInvoicesCollection = db.collection('universalInvoices');

    // Get all existing invoices from the old collection for this user
    const oldInvoices = await oldInvoicesCollection.find({ userId: uid }).toArray();
    
    if (oldInvoices.length === 0) {
      return NextResponse.json({ 
        message: 'No invoices to migrate.',
        migrated: 0
      }, { status: 200 });
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const oldInvoice of oldInvoices) {
      // Check if this invoice already exists in universalInvoices
      const existingInvoice = await universalInvoicesCollection.findOne({
        userId: uid,
        universalNumber: oldInvoice.universalNumber
      });

      if (existingInvoice) {
        skippedCount++;
        console.log(`Skipped existing invoice: ${oldInvoice.universalNumber}`);
        continue;
      }

      // Convert old invoice format to new universalInvoices format
      const newInvoiceDoc = {
        userId: uid,
        universalNumber: oldInvoice.universalNumber,
        storeInvoiceNumber: oldInvoice.storeInvoiceNumber,
        storeName: oldInvoice.storeName,
        wooCommerceOrderId: oldInvoice.id || oldInvoice._id.toString(),
        amount: oldInvoice.amount,
        status: oldInvoice.status,
        customerName: oldInvoice.customerName,
        customerEmail: oldInvoice.customerEmail || '',
        createdAt: oldInvoice.createdAt,
        dueDate: oldInvoice.dueDate,
        orderStatus: undefined, // Old manual invoices don't have order status
        paymentMethod: oldInvoice.paymentMethod || '',
        customerAddress: oldInvoice.billingAddress || {},
        items: oldInvoice.items || [],
        source: 'manual', // All old invoices were manual
        savedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        migratedFrom: 'invoices_collection' // Flag to track migration
      };

      // Insert into universalInvoices collection
      await universalInvoicesCollection.insertOne(newInvoiceDoc);
      migratedCount++;
      console.log(`Migrated invoice: ${oldInvoice.universalNumber}`);
    }

    console.log(`Migration completed: ${migratedCount} migrated, ${skippedCount} skipped`);

    return NextResponse.json({ 
      message: `Migration completed successfully. ${migratedCount} invoices migrated, ${skippedCount} already existed.`,
      migrated: migratedCount,
      skipped: skippedCount,
      total: oldInvoices.length
    }, { status: 200 });

  } catch (err) {
    console.error('Migration error:', err);
    return NextResponse.json({ message: 'Internal server error during migration.' }, { status: 500 });
  }
}
