import { NextRequest, NextResponse } from 'next/server';
import { uploadCampAsset } from '@/lib/storage';

/** POST /api/admin/camps/upload-photo — upload camp cover, gallery, or room photo */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const campId = formData.get('campId') as string;
    const file = formData.get('file') as File | null;
    const isRoom = formData.get('isRoom') === 'true';
    const roomId = formData.get('roomId') as string;

    if (!campId || !file) {
      return NextResponse.json({ error: 'campId dan file wajib diisi' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate a unique filename to prevent browser cache issues
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Subpath structure:
    // Cover/Gallery: [campId]/gallery/[timestamp]-[fileName]
    // Rooms: [campId]/rooms/[roomId]/[timestamp]-[fileName]
    const subPath = isRoom 
      ? `rooms/${roomId || 'general'}/${timestamp}-${cleanFileName}`
      : `gallery/${timestamp}-${cleanFileName}`;

    const publicUrl = await uploadCampAsset(campId, subPath, buffer, file.type);
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('Error uploading camp photo:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
