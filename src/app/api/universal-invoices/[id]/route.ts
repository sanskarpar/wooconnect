import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { ObjectId } from 'mongodb';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;
    const updateData = await req.json();

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const universalInvoicesCollection = db.collection('universalInvoices');

    // Find the invoice by wooCommerceOrderId or _id and userId
    let invoiceQuery: any = {
      userId: uid,
      wooCommerceOrderId: invoiceId
    };

    // If the invoiceId looks like a MongoDB ObjectId (24 hex characters), also search by _id
    if (/^[0-9a-fA-F]{24}$/.test(invoiceId)) {
      invoiceQuery = {
        userId: uid,
        $or: [
          { wooCommerceOrderId: invoiceId },
          { _id: new ObjectId(invoiceId) }
        ]
      };
    }

    const existingInvoice = await universalInvoicesCollection.findOne(invoiceQuery);
    if (!existingInvoice) {
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 });
    }

    // Prepare update data
    const updateFields: any = {
      lastUpdated: new Date().toISOString()
    };

    // Update allowed fields
    const allowedFields = [
      'universalNumber', 'storeInvoiceNumber', 'storeName', 'amount', 'status',
      'customerName', 'customerEmail', 'createdAt', 'dueDate', 'orderStatus',
      'paymentMethod', 'customerAddress', 'items'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    });

    // Convert amount to number if provided
    if (updateFields.amount !== undefined) {
      updateFields.amount = parseFloat(updateFields.amount) || 0;
    }

    // Update the invoice
    const result = await universalInvoicesCollection.updateOne(
      invoiceQuery,
      { $set: updateFields }
    );

    if (!result.acknowledged) {
      return NextResponse.json({ message: 'Failed to update invoice.' }, { status: 500 });
    }

    // Get the updated invoice
    const updatedInvoice = await universalInvoicesCollection.findOne(invoiceQuery);

    return NextResponse.json({ 
      message: 'Invoice updated successfully.',
      invoice: updatedInvoice 
    }, { status: 200 });

  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const universalInvoicesCollection = db.collection('universalInvoices');

    // Find and delete the invoice by wooCommerceOrderId or _id and userId
    let invoiceQuery: any = {
      userId: uid,
      wooCommerceOrderId: invoiceId
    };

    // If the invoiceId looks like a MongoDB ObjectId (24 hex characters), also search by _id
    if (/^[0-9a-fA-F]{24}$/.test(invoiceId)) {
      invoiceQuery = {
        userId: uid,
        $or: [
          { wooCommerceOrderId: invoiceId },
          { _id: new ObjectId(invoiceId) }
        ]
      };
    }

    const result = await universalInvoicesCollection.deleteOne(invoiceQuery);

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Invoice deleted successfully.' 
    }, { status: 200 });

  } catch (error) {
    console.error('Delete invoice error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
