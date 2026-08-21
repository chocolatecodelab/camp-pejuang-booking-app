'use client';

import { useState, useEffect } from 'react';
import { getCampTypeLabel, getCampTypeColor, formatRupiah, getYouTubeEmbedUrl, compressImage } from '@/lib/utils/helpers';
import Swal from 'sweetalert2';

interface PricingPackage {
  id?: string;
  room_id: string;
  label: string;
  occupancy_label?: string | null;
  occupancy_tier?: number;
  slots_consumed?: number;
  duration_days: number;
  price: number;
  min_dp_amount: number | null;
  sort_order: number;
  is_active: boolean;
}

interface Room {
  id?: string;
  camp_id: string;
  name: string;
  floor_label: string;
  capacity?: number;
  room_photo_urls: string[] | null;
  is_active: boolean;
}

interface Camp {
  id: string;
  name: string;
  slug: string;
  type: 'putra' | 'putri' | 'campuran';
  address: string;
  description: string | null;
  facilities: string[] | null;
  cover_photo_url: string | null;
  youtube_video_url?: string | null;
  gallery_photo_urls?: string[] | null;
  is_active: boolean;
}

export default function AdminCampsPage() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [packages, setPackages] = useState<PricingPackage[]>([]);

  const [loading, setLoading] = useState(true);

  // Selection states for drilling down
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Modal states
  const [activeModal, setActiveModal] = useState<'none' | 'camp' | 'room' | 'package'>('none');
  const [editingCamp, setEditingCamp] = useState<Camp | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingPackage, setEditingPackage] = useState<PricingPackage | null>(null);

  const [campForm, setCampForm] = useState({
    name: '',
    slug: '',
    type: 'putra' as 'putra' | 'putri' | 'campuran',
    address: '',
    description: '',
    facilitiesStr: '',
    cover_photo_url: '',
    youtube_video_url: '',
    gallery_photo_urls: [] as string[],
    is_active: true
  });

  const [roomForm, setRoomForm] = useState({
    name: '', floor_label: 'Lantai 1', capacity: 3, room_photo_urls: [] as string[], is_active: true
  });

  const [packageForm, setPackageForm] = useState({
    label: '', occupancy_label: '', occupancy_tier: '' as number | string, slots_consumed: 1, duration_days: '' as number | string, price: '' as number | string, min_dp_amount: '', sort_order: 1, is_active: true
  });

  // Photo upload states
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingRoom, setUploadingRoom] = useState(false);

  useEffect(() => {
    fetchCamps();
  }, []);

  useEffect(() => {
    if (selectedCamp) {
      fetchRooms(selectedCamp.id!);
      setSelectedRoom(null);
      setPackages([]);
    }
  }, [selectedCamp]);

  useEffect(() => {
    if (selectedRoom) {
      fetchPackages(selectedRoom.id!);
    }
  }, [selectedRoom]);

  const fetchCamps = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/camps');
      const data = await res.json();
      if (data.camps) {
        setCamps(data.camps);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async (campId: string) => {
    try {
      const res = await fetch(`/api/admin/camps/${campId}/rooms`);
      const data = await res.json();
      if (data.rooms) setRooms(data.rooms);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPackages = async (roomId: string) => {
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/pricing`);
      const data = await res.json();
      if (data.pricing_packages) setPackages(data.pricing_packages);
    } catch (err) {
      console.error(err);
    }
  };

  // CAMP CRUD ACTIONS
  const handleOpenCampModal = (camp: Camp | null = null) => {
    if (camp) {
      setEditingCamp(camp);
      setCampForm({
        name: camp.name,
        slug: camp.slug,
        type: camp.type,
        address: camp.address,
        description: camp.description || '',
        facilitiesStr: camp.facilities?.join(', ') || '',
        cover_photo_url: camp.cover_photo_url || '',
        youtube_video_url: camp.youtube_video_url || '',
        gallery_photo_urls: (camp as any).gallery_photo_urls || [],
        is_active: camp.is_active
      });
    } else {
      setEditingCamp(null);
      setCampForm({
        name: '',
        slug: '',
        type: 'putra',
        address: '',
        description: '',
        facilitiesStr: 'Free Wifi, AC, Kamar Mandi Dalam',
        cover_photo_url: '',
        youtube_video_url: '',
        gallery_photo_urls: [],
        is_active: true
      });
    }
    setActiveModal('camp');
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingCover(true);
    try {
      const compressedFile = await compressImage(files[0]);
      const formData = new FormData();
      formData.append('campId', editingCamp?.id || 'temp-camp');
      formData.append('file', compressedFile);
      formData.append('isRoom', 'false');

      const res = await fetch('/api/admin/camps/upload-photo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        Swal.fire('Upload Gagal', data.error || 'Terjadi kesalahan', 'error');
        return;
      }

      setCampForm(prev => ({ ...prev, cover_photo_url: data.url }));
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal mengupload foto sampul', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    try {
      const uploadedUrls: string[] = [...campForm.gallery_photo_urls];

      for (let i = 0; i < files.length; i++) {
        const compressedFile = await compressImage(files[i]);
        const formData = new FormData();
        formData.append('campId', editingCamp?.id || 'temp-camp');
        formData.append('file', compressedFile);
        formData.append('isRoom', 'false');

        const res = await fetch('/api/admin/camps/upload-photo', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        }
      }

      setCampForm(prev => ({ ...prev, gallery_photo_urls: uploadedUrls }));
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal mengupload beberapa foto galeri', 'error');
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleRoomPhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedCamp) return;

    setUploadingRoom(true);
    try {
      const uploadedUrls: string[] = [...roomForm.room_photo_urls];

      for (let i = 0; i < files.length; i++) {
        const compressedFile = await compressImage(files[i]);
        const formData = new FormData();
        formData.append('campId', selectedCamp.id!);
        formData.append('file', compressedFile);
        formData.append('isRoom', 'true');
        formData.append('roomId', editingRoom?.id || 'temp-room');

        const res = await fetch('/api/admin/camps/upload-photo', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        }
      }

      setRoomForm(prev => ({ ...prev, room_photo_urls: uploadedUrls }));
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal mengupload beberapa foto kamar', 'error');
    } finally {
      setUploadingRoom(false);
    }
  };

  const handleSaveCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: campForm.name,
      slug: campForm.slug || campForm.name.toLowerCase().replace(/ /g, '-'),
      type: campForm.type,
      address: campForm.address,
      description: campForm.description || null,
      facilities: campForm.facilitiesStr.split(',').map((f) => f.trim()).filter(Boolean),
      cover_photo_url: campForm.cover_photo_url || null,
      youtube_video_url: campForm.youtube_video_url || null,
      gallery_photo_urls: campForm.gallery_photo_urls || [],
      is_active: campForm.is_active
    };

    try {
      let res;
      if (editingCamp) {
        res = await fetch(`/api/admin/camps`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCamp.id, ...payload })
        });
      } else {
        res = await fetch(`/api/admin/camps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error('Gagal menyimpan Camp');

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Camp berhasil disimpan', confirmButtonColor: '#b52330' });
      setActiveModal('none');
      fetchCamps();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#b52330' });
    }
  };

  // ROOM CRUD ACTIONS
  const handleOpenRoomModal = (room: Room | null = null) => {
    if (!selectedCamp) return;
    if (room) {
      setEditingRoom(room);
      setRoomForm({
        name: room.name,
        floor_label: room.floor_label,
        capacity: room.capacity || 3,
        room_photo_urls: room.room_photo_urls || [],
        is_active: room.is_active
      });
    } else {
      setEditingRoom(null);
      setRoomForm({
        name: '', floor_label: 'Lantai 1', capacity: 3, room_photo_urls: [], is_active: true
      });
    }
    setActiveModal('room');
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCamp) return;
    const payload = {
      camp_id: selectedCamp.id,
      name: roomForm.name,
      floor_label: roomForm.floor_label,
      capacity: Number(roomForm.capacity) || 3,
      room_photo_urls: roomForm.room_photo_urls.length > 0 ? roomForm.room_photo_urls : null,
      is_active: roomForm.is_active
    };

    try {
      let res;
      if (editingRoom) {
        res = await fetch(`/api/admin/camps/${selectedCamp.id}/rooms`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingRoom.id, ...payload })
        });
      } else {
        res = await fetch(`/api/admin/camps/${selectedCamp.id}/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error('Gagal menyimpan Kamar');

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Kamar berhasil disimpan', confirmButtonColor: '#b52330' });
      setActiveModal('none');
      fetchRooms(selectedCamp.id!);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#b52330' });
    }
  };

  // PRICING PACKAGE CRUD ACTIONS
  const handleOpenPackageModal = (pkg: PricingPackage | null = null) => {
    if (!selectedRoom) return;
    if (pkg) {
      setEditingPackage(pkg);
      setPackageForm({
        label: pkg.label || '',
        occupancy_label: pkg.occupancy_label || '',
        occupancy_tier: pkg.occupancy_tier || '',
        slots_consumed: pkg.slots_consumed || 1,
        duration_days: pkg.duration_days || '',
        price: pkg.price || '',
        min_dp_amount: pkg.min_dp_amount ? String(pkg.min_dp_amount) : '',
        sort_order: pkg.sort_order || 1,
        is_active: pkg.is_active
      });
    } else {
      setEditingPackage(null);
      setPackageForm({
        label: '',
        occupancy_label: '',
        occupancy_tier: '',
        slots_consumed: 1,
        duration_days: '',
        price: '',
        min_dp_amount: '',
        sort_order: (packages.length + 1) || 1,
        is_active: true
      });
    }
    setActiveModal('package');
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    const occTier = Number(packageForm.occupancy_tier) || 1;
    const slotsConsumed = occTier === 1 ? (selectedRoom.capacity || 1) : 1;

    const payload = {
      room_id: selectedRoom.id,
      label: packageForm.label || packageForm.occupancy_label || 'Paket Sewa',
      occupancy_label: packageForm.occupancy_label || packageForm.label || (occTier === 1 ? 'Private 1 Orang' : `Sharing ${occTier} Orang`),
      occupancy_tier: occTier,
      slots_consumed: slotsConsumed,
      duration_days: Number(packageForm.duration_days) || 30,
      price: Number(packageForm.price) || 0,
      min_dp_amount: packageForm.min_dp_amount ? Number(packageForm.min_dp_amount) : null,
      sort_order: Number(packageForm.sort_order) || 1,
      is_active: packageForm.is_active
    };

    try {
      let res;
      if (editingPackage) {
        res = await fetch(`/api/admin/rooms/${selectedRoom.id}/pricing`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPackage.id, ...payload })
        });
      } else {
        res = await fetch(`/api/admin/rooms/${selectedRoom.id}/pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error('Gagal menyimpan Paket Harga');

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Paket Harga berhasil disimpan', confirmButtonColor: '#b52330' });
      setActiveModal('none');
      fetchPackages(selectedRoom.id!);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#b52330' });
    }
  };

  const handleDeleteCamp = async (camp: Camp) => {
    const result = await Swal.fire({
      title: 'Hapus Camp?',
      text: `Apakah Anda yakin ingin menghapus camp "${camp.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b52330',
      cancelButtonColor: '#6e6e6e',
      confirmButtonText: 'Ya, Hapus Camp',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch('/api/admin/camps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: camp.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus camp');

      Swal.fire({ icon: 'success', title: 'Terhapus', text: `Camp "${camp.name}" berhasil dihapus`, confirmButtonColor: '#b52330' });
      if (selectedCamp?.id === camp.id) {
        setSelectedCamp(null);
        setRooms([]);
        setSelectedRoom(null);
        setPackages([]);
      }
      fetchCamps();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message, confirmButtonColor: '#b52330' });
    }
  };

  const handleDeleteRoom = async (room: Room) => {
    if (!selectedCamp) return;
    const result = await Swal.fire({
      title: 'Hapus Kamar?',
      text: `Apakah Anda yakin ingin menghapus kamar "${room.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b52330',
      cancelButtonColor: '#6e6e6e',
      confirmButtonText: 'Ya, Hapus Kamar',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/camps/${selectedCamp.id}/rooms`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: room.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus kamar');

      Swal.fire({ icon: 'success', title: 'Terhapus', text: `Kamar "${room.name}" berhasil dihapus`, confirmButtonColor: '#b52330' });
      if (selectedRoom?.id === room.id) {
        setSelectedRoom(null);
        setPackages([]);
      }
      fetchRooms(selectedCamp.id!);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message, confirmButtonColor: '#b52330' });
    }
  };

  const handleDeletePackage = async (pkg: PricingPackage) => {
    if (!selectedRoom) return;
    const result = await Swal.fire({
      title: 'Hapus Paket Harga?',
      text: `Apakah Anda yakin ingin menghapus paket "${pkg.label}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b52330',
      cancelButtonColor: '#6e6e6e',
      confirmButtonText: 'Ya, Hapus Paket',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/rooms/${selectedRoom.id}/pricing`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pkg.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus paket harga');

      Swal.fire({ icon: 'success', title: 'Terhapus', text: `Paket "${pkg.label}" berhasil dihapus`, confirmButtonColor: '#b52330' });
      fetchPackages(selectedRoom.id!);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Hapus', text: err.message, confirmButtonColor: '#b52330' });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Data Camp & Kamar</h1>
          <p className="text-body-md text-on-surface-variant">Kelola data properti camp, kamar, lantai, dan skema paket harga sewa.</p>
        </div>
        <button
          onClick={() => handleOpenCampModal()}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Tambah Camp
        </button>
      </div>

      {/* Main Multi-drilldown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Column 1: Camps List (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#EAEAEA] shadow-sm p-4 space-y-4">
          <h3 className="text-label-sm font-bold text-primary uppercase tracking-wider">1. Pilih Camp</h3>
          <div className="space-y-2">
            {camps.map((camp) => (
              <div
                key={camp.id}
                onClick={() => setSelectedCamp(camp)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex justify-between items-center ${selectedCamp?.id === camp.id
                    ? 'border-primary bg-primary/5'
                    : 'border-[#EAEAEA] hover:bg-neutral-50'
                  }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="font-bold text-on-surface truncate">{camp.name}</p>
                  <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${getCampTypeColor(camp.type)}`}>
                    {getCampTypeLabel(camp.type)}
                  </span>
                  {!camp.is_active && (
                    <span className="text-[10px] bg-red-100 text-red-800 px-1 py-0.2 rounded ml-1 font-bold">Non-aktif</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCampModal(camp);
                    }}
                    className="p-1 rounded hover:bg-neutral-200 text-outline hover:text-on-surface"
                    title="Edit Camp"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">edit</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCamp(camp);
                    }}
                    className="p-1 rounded hover:bg-red-100 text-red-600 hover:text-red-800 transition-colors"
                    title="Hapus Camp"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Rooms List (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#EAEAEA] shadow-sm p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-label-sm font-bold text-primary uppercase tracking-wider">2. Kamar di Camp</h3>
            {selectedCamp && (
              <button
                onClick={() => handleOpenRoomModal()}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-xs">add</span> Tambah Kamar
              </button>
            )}
          </div>

          {!selectedCamp ? (
            <p className="text-xs text-outline italic py-8 text-center bg-neutral-50 border border-dashed border-[#EAEAEA] rounded-lg">
              Pilih camp di sebelah kiri untuk mengelola kamar.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-outline font-semibold uppercase tracking-wider">Camp: {selectedCamp.name}</p>
              {rooms.length === 0 ? (
                <p className="text-xs text-outline py-4 text-center">Belum ada kamar di camp ini.</p>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer flex justify-between items-center ${selectedRoom?.id === room.id
                        ? 'border-primary bg-primary/5'
                        : 'border-[#EAEAEA] hover:bg-neutral-50'
                      }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-on-surface">{room.name}</p>
                      <p className="text-[10px] text-outline font-medium">{room.floor_label}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRoomModal(room);
                        }}
                        className="p-1 rounded hover:bg-neutral-200 text-outline hover:text-on-surface"
                        title="Edit Kamar"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoom(room);
                        }}
                        className="p-1 rounded hover:bg-red-100 text-red-600 hover:text-red-800 transition-colors"
                        title="Hapus Kamar"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Column 3: Pricing Packages List (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#EAEAEA] shadow-sm p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-label-sm font-bold text-primary uppercase tracking-wider">3. Paket Harga Kamar</h3>
            {selectedRoom && (
              <button
                onClick={() => handleOpenPackageModal()}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-xs">add</span> Tambah Paket
              </button>
            )}
          </div>

          {!selectedRoom ? (
            <p className="text-xs text-outline italic py-8 text-center bg-neutral-50 border border-dashed border-[#EAEAEA] rounded-lg">
              Pilih kamar di atas/tengah untuk mengelola paket harga.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-outline font-semibold uppercase tracking-wider">Kamar: {selectedRoom.name}</p>
              {packages.length === 0 ? (
                <p className="text-xs text-outline py-4 text-center">Belum ada paket harga di kamar ini.</p>
              ) : (
                packages.map((pkg) => {
                  const occupancyText = pkg.occupancy_label && pkg.occupancy_label.trim() !== ''
                    ? pkg.occupancy_label
                    : pkg.occupancy_tier === 3
                      ? 'Sharing 3 Orang'
                      : pkg.occupancy_tier === 2
                        ? 'Sharing 2 Orang'
                        : pkg.occupancy_tier === 1
                          ? 'Private 1 Kamar'
                          : 'Sharing';

                  const targetCount = pkg.occupancy_tier || (occupancyText.includes('3') ? 3 : occupancyText.includes('2') ? 2 : 1);
                  const isPrivate = targetCount === 1 || occupancyText.toLowerCase().includes('private');

                  return (
                    <div
                      key={pkg.id}
                      className="p-3.5 rounded-xl border border-[#EAEAEA] bg-white hover:border-primary/30 transition-all flex justify-between items-center shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-on-surface">{occupancyText}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border flex items-center gap-1 ${isPrivate
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-primary/10 text-primary border-primary/20'
                            }`}>
                            <span className="material-symbols-outlined text-[12px]">group</span>
                            {isPrivate ? '1 Orang (Private)' : `Sharing ${targetCount} Orang`}
                          </span>
                        </div>
                        <p className="text-xs text-outline font-medium">
                          Durasi: <span className="text-on-surface font-semibold">{pkg.label} ({pkg.duration_days} Hari)</span>
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-xs text-primary font-bold">{formatRupiah(pkg.price)}</span>
                          {pkg.min_dp_amount ? (
                            <span className="text-[10px] text-success-green font-medium">• Bisa DP {formatRupiah(pkg.min_dp_amount)}</span>
                          ) : (
                            <span className="text-[10px] text-outline font-medium">• Wajib Bayar Lunas</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleOpenPackageModal(pkg)}
                          className="p-1.5 rounded-lg hover:bg-neutral-100 text-outline hover:text-on-surface transition-colors"
                          title="Edit Paket"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeletePackage(pkg)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-800 transition-colors"
                          title="Hapus Paket"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>

      {/* Camp Create/Edit Modal */}
      {activeModal === 'camp' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveCamp}
            className="bg-white rounded-xl border border-[#EAEAEA] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-scale-up overflow-hidden"
          >
            {/* Modal Header (Sticky Top) */}
            <div className="p-5 border-b border-[#EAEAEA] flex justify-between items-center bg-neutral-50 shrink-0">
              <h3 className="text-headline-sm text-base font-bold text-on-surface">
                {editingCamp ? 'Edit Camp' : 'Tambah Camp Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded hover:bg-neutral-200 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body (Scrollable Content) */}
            <div className="p-6 overflow-y-auto flex-grow space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Nama Camp</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Camp Pejuang Putra 1"
                    value={campForm.name}
                    onChange={(e) => setCampForm({ ...campForm, name: e.target.value })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Slug (URL)</label>
                  <input
                    type="text"
                    placeholder="Contoh: camp-pejuang-putra-1"
                    value={campForm.slug}
                    onChange={(e) => setCampForm({ ...campForm, slug: e.target.value })}
                    className="w-full p-2 border border-[#EAEAEA] rounded text-xs focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Tipe Camp</label>
                  <select
                    value={campForm.type}
                    onChange={(e) => setCampForm({ ...campForm, type: e.target.value as any })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  >
                    <option value="putra">Khusus Putra</option>
                    <option value="putri">Khusus Putri</option>
                    <option value="campuran">Campuran</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Alamat Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Jl. Asoka No. 23, Pare"
                    value={campForm.address}
                    onChange={(e) => setCampForm({ ...campForm, address: e.target.value })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-label-sm font-semibold">Fasilitas (pisahkan dengan koma)</label>
                <input
                  type="text"
                  placeholder="Wifi, AC, Kamar Mandi Dalam"
                  value={campForm.facilitiesStr}
                  onChange={(e) => setCampForm({ ...campForm, facilitiesStr: e.target.value })}
                  className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-label-sm font-semibold">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  placeholder="Tuliskan deskripsi lingkungan, keunggulan, atau catatan camp..."
                  value={campForm.description}
                  onChange={(e) => setCampForm({ ...campForm, description: e.target.value })}
                  className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary text-xs"
                />
              </div>

              {/* Foto Sampul Utama Camp (Cover Photo) */}
              <div className="space-y-2 border border-[#EAEAEA] py-3 px-3 my-2 bg-neutral-50 rounded-lg">
                <label className="text-label-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-lg font-bold">image</span>
                  Foto Sampul Utama Camp (Cover Photo)
                </label>
                {campForm.cover_photo_url ? (
                  <div className="relative border border-border-subtle rounded-lg p-2 bg-white flex items-center gap-3">
                    <img
                      src={campForm.cover_photo_url}
                      alt="Foto Sampul"
                      className="h-20 w-16 object-cover rounded shadow-sm border"
                    />
                    <div className="space-y-1 flex-grow">
                      <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span> Foto Sampul Tersedia
                      </p>
                      <button
                        type="button"
                        onClick={() => setCampForm({ ...campForm, cover_photo_url: '' })}
                        className="text-[11px] text-red-600 font-bold hover:underline"
                      >
                        Ganti / Hapus Foto Sampul
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      disabled={uploadingCover}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                    />
                    {uploadingCover && <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>}
                  </div>
                )}
                <p className="text-[11px] text-outline">
                  Foto ini akan tampil sebagai gambar utama di kartu katalog depan beranda pengunjung.
                </p>
              </div>

              {/* Video Sampul (YouTube Link) */}
              <div className="space-y-2 border border-[#EAEAEA] py-3 px-3 my-2 bg-neutral-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <label className="text-label-sm font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-red-600 text-lg font-bold">smart_display</span>
                    Link Video YouTube Sampul (Tur Camp)
                  </label>
                  {getYouTubeEmbedUrl(campForm.youtube_video_url) ? (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Video Valid
                    </span>
                  ) : campForm.youtube_video_url ? (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      ⚠️ Link tidak valid
                    </span>
                  ) : null}
                </div>

                <input
                  type="url"
                  placeholder="Contoh: https://www.youtube.com/watch?v=dQw4w9WgXcQ atau https://youtu.be/..."
                  value={campForm.youtube_video_url}
                  onChange={(e) => setCampForm({ ...campForm, youtube_video_url: e.target.value })}
                  className="w-full p-2 border border-[#EAEAEA] bg-white rounded text-xs outline-none focus:border-primary font-mono"
                />
                <p className="text-[11px] text-outline">
                  Link ini akan menampilkan pemutar video YouTube di bagian sampul utama halaman detail camp pengunjung.
                </p>

                {/* Interactive Live Video Preview inside Admin Modal */}
                {getYouTubeEmbedUrl(campForm.youtube_video_url) && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-border-subtle bg-black shadow-sm aspect-video max-w-full">
                    <iframe
                      src={getYouTubeEmbedUrl(campForm.youtube_video_url)!}
                      title="Pratinjau Video Sampul"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>
                )}
              </div>

              {/* Gallery Photos Upload */}
              <div className="space-y-2">
                <label className="text-label-sm font-semibold block">Galeri Foto Camp Lainnya (Format 9:16 Portrait Diterima)</label>
                <div className="flex flex-wrap gap-2.5 mb-2">
                  {(campForm.gallery_photo_urls || []).map((url, idx) => (
                    <div key={idx} className="relative border border-border-subtle rounded-lg p-1 bg-neutral-900 shadow-sm">
                      <img src={url} alt={`Gallery ${idx}`} className="h-20 w-14 rounded object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = campForm.gallery_photo_urls.filter((_, i) => i !== idx);
                          setCampForm({ ...campForm, gallery_photo_urls: updated });
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-800 text-white rounded-full p-0.5 shadow-md flex items-center justify-center animate-fade-in"
                        title="Hapus"
                      >
                        <span className="material-symbols-outlined text-[10px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGalleryUpload}
                    disabled={uploadingGallery}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                  {uploadingGallery && <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="camp-active"
                  checked={campForm.is_active}
                  onChange={(e) => setCampForm({ ...campForm, is_active: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="camp-active" className="text-label-sm font-semibold cursor-pointer select-none">Camp Aktif (Ditampilkan Publik)</label>
              </div>
            </div>

            {/* Modal Footer (Sticky Bottom) */}
            <div className="p-4 bg-neutral-50 border-t border-[#EAEAEA] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 border border-outline-variant hover:bg-neutral-200 text-on-surface font-bold text-xs rounded transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-primary text-white font-bold text-xs rounded hover:bg-[#93000a] transition-colors shadow-sm"
              >
                Simpan Camp
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Room Create/Edit Modal */}
      {activeModal === 'room' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveRoom}
            className="bg-white rounded-xl border border-[#EAEAEA] shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col animate-scale-up overflow-hidden"
          >
            {/* Header (Sticky Top) */}
            <div className="p-5 border-b border-[#EAEAEA] flex justify-between items-center bg-neutral-50 shrink-0">
              <h3 className="text-headline-sm text-base font-bold text-on-surface">
                {editingRoom ? 'Edit Kamar' : 'Tambah Kamar Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded hover:bg-neutral-200 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="p-6 overflow-y-auto flex-grow space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-label-sm font-semibold">Nama Kamar</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kamar 101, Kamar A-3"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Label Lantai</label>
                  <select
                    value={roomForm.floor_label}
                    onChange={(e) => setRoomForm({ ...roomForm, floor_label: e.target.value })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  >
                    <option value="Lantai 1">Lantai 1</option>
                    <option value="Lantai 2">Lantai 2</option>
                    <option value="Lantai 3">Lantai 3</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Kapasitas Maksimal (Orang)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-outline">Jumlah maksimal orang/penghuni dalam kamar ini (cth: 3 orang).</p>
                </div>
              </div>

              {/* Room Photos Upload */}
              <div className="space-y-2">
                <label className="text-label-sm font-semibold block">Foto Kamar (Format 9:16 Portrait Diterima)</label>
                <div className="flex flex-wrap gap-2.5 mb-2">
                  {(roomForm.room_photo_urls || []).map((url, idx) => (
                    <div key={idx} className="relative border border-border-subtle rounded-lg p-1 bg-neutral-900 shadow-sm">
                      <img src={url} alt={`Room ${idx}`} className="h-20 w-14 rounded object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = roomForm.room_photo_urls.filter((_, i) => i !== idx);
                          setRoomForm({ ...roomForm, room_photo_urls: updated });
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-800 text-white rounded-full p-0.5 shadow-md flex items-center justify-center animate-fade-in"
                        title="Hapus"
                      >
                        <span className="material-symbols-outlined text-[10px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleRoomPhotosUpload}
                    disabled={uploadingRoom}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                  {uploadingRoom && <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="room-active"
                  checked={roomForm.is_active}
                  onChange={(e) => setRoomForm({ ...roomForm, is_active: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="room-active" className="text-label-sm font-semibold cursor-pointer select-none">
                  Kamar Aktif (Tersedia untuk Booking)
                </label>
              </div>
            </div>

            {/* Footer (Sticky Bottom) */}
            <div className="p-4 bg-neutral-50 border-t border-[#EAEAEA] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 border border-outline-variant hover:bg-neutral-200 text-on-surface font-bold text-xs rounded transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-primary text-white font-bold text-xs rounded hover:bg-[#93000a] transition-colors shadow-sm"
              >
                Simpan Kamar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pricing Package Create/Edit Modal */}
      {activeModal === 'package' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSavePackage}
            className="bg-white rounded-xl border border-[#EAEAEA] shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col animate-scale-up overflow-hidden"
          >
            {/* Header (Sticky Top) */}
            <div className="p-5 border-b border-[#EAEAEA] flex justify-between items-center bg-neutral-50 shrink-0">
              <h3 className="text-headline-sm text-base font-bold text-on-surface">
                {editingPackage ? 'Edit Paket Harga' : 'Tambah Paket Harga'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded hover:bg-neutral-200 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="p-6 overflow-y-auto flex-grow space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Nama Opsi Hunian (Sharing/Private)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Sharing 3 Orang, Private Sendiri"
                    value={packageForm.occupancy_label}
                    onChange={(e) => setPackageForm({
                      ...packageForm,
                      occupancy_label: e.target.value,
                    })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-outline">Judul tipe kamar (cth: Sharing 3 Orang)</p>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Label Durasi / Periode</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 1 Bulan, 2 Minggu"
                    value={packageForm.label}
                    onChange={(e) => setPackageForm({
                      ...packageForm,
                      label: e.target.value,
                    })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-outline">Label periode (cth: 1 Bulan, 2 Minggu)</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Target Penghuni</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={packageForm.occupancy_tier}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPackageForm({ ...packageForm, occupancy_tier: val, slots_consumed: 1 });
                    }}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-outline">Jumlah org (cth: 3)</p>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Durasi (Hari)</label>
                  <input
                    type="number"
                    required
                    placeholder="30"
                    value={packageForm.duration_days}
                    onChange={(e) => setPackageForm({ ...packageForm, duration_days: Number(e.target.value) })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-outline">30 hari = 1 bln</p>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Urutan Sortir</label>
                  <input
                    type="number"
                    required
                    placeholder="1"
                    value={packageForm.sort_order}
                    onChange={(e) => setPackageForm({ ...packageForm, sort_order: Number(e.target.value) })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Harga Sewa (Rp)</label>
                  <input
                    type="number"
                    required
                    placeholder="500000"
                    value={packageForm.price}
                    onChange={(e) => setPackageForm({ ...packageForm, price: Number(e.target.value) })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-semibold">Minimal DP (Rp)</label>
                  <input
                    type="number"
                    placeholder="150000"
                    value={packageForm.min_dp_amount}
                    onChange={(e) => setPackageForm({ ...packageForm, min_dp_amount: e.target.value })}
                    className="w-full p-2 border border-[#EAEAEA] rounded focus:outline-none focus:border-primary text-xs"
                  />
                  <p className="text-[10px] text-outline">Kosongkan jika harus bayar lunas.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="pkg-active"
                  checked={packageForm.is_active}
                  onChange={(e) => setPackageForm({ ...packageForm, is_active: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="pkg-active" className="text-label-sm font-semibold cursor-pointer select-none">
                  Paket Aktif (Ditampilkan Publik)
                </label>
              </div>
            </div>

            {/* Footer (Sticky Bottom) */}
            <div className="p-4 bg-neutral-50 border-t border-[#EAEAEA] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 border border-outline-variant hover:bg-neutral-200 text-on-surface font-bold text-xs rounded transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-primary text-white font-bold text-xs rounded hover:bg-[#93000a] transition-colors shadow-sm"
              >
                Simpan Paket
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
