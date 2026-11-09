import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Camera,
    Trash2,
    X,
    Plus,
    Image as ImageIcon,
    Play,
    Film,
    Loader2,
    Zap,
    CheckCircle2,
    Folder,
    FolderPlus,
    FolderOpen,
    ArrowUpDown,
    CheckSquare,
    Square,
    Edit3,
    Calendar
} from 'lucide-react';
import { useCollection, useDocument } from '../hooks/useFirestore';
import { useStorage } from '../hooks/useStorage';

const isVideoItem = (item) => {
    if (!item) return false;
    if (item.mediaType === 'video') return true;
    if (item.mimeType && item.mimeType.startsWith('video/')) return true;
    const target = `${item.name || ''} ${item.filePath || ''} ${item.url || ''}`;
    return /\.(mp4|mov|webm|m4v|3gp|avi|mkv)(\?|$)/i.test(target);
};

const formatMB = (bytes) => {
    if (!bytes || bytes <= 0) return '0.0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatShortDate = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
};

const toDateInputValue = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const Gallery = () => {
    const { data: photos, loading: photosLoading, update: updatePhoto } = useCollection('photos');
    const { data: galleryDoc, update: updateGalleryDoc } = useDocument('gallery');
    const {
        uploadFile,
        deleteFile,
        replaceExistingVideoWithFile,
        getCachedVideoBlob,
        ensurePosterForExistingVideo,
        isUploading,
        isOptimizingId,
        progress,
        statusText,
        bytesInfo
    } = useStorage();

    // Ordner- & Filter-Status
    const [activeFolderId, setActiveFolderId] = useState('ALL'); // 'ALL' | 'UNASSIGNED' | folder.id
    const [mediaFilter, setMediaFilter] = useState('all'); // 'all' | 'image' | 'video'
    const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'name-asc' | 'size-desc'

    // Neuer Ordner / Ordner bearbeiten
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isRenamingFolder, setIsRenamingFolder] = useState(false);
    const [renameFolderValue, setRenameFolderValue] = useState('');

    // Mehrfachauswahl zum schnellen Zuordnen in Ordner
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [batchTargetFolderId, setBatchTargetFolderId] = useState('');
    const [isBatchMoving, setIsBatchMoving] = useState(false);

    // Vollbild-Modal & Video-Player
    const [selectedImg, setSelectedImg] = useState(null);
    const [resolvedVideoSrc, setResolvedVideoSrc] = useState(null);
    const [isVideoBuffering, setIsVideoBuffering] = useState(false);
    const [replaceTargetItem, setReplaceTargetItem] = useState(null);
    const playerRef = useRef(null);
    const replaceInputRef = useRef(null);
    const activeObjectUrlRef = useRef(null);
    const posterCapturedForIdRef = useRef(new Set());

    const folders = useMemo(() => {
        const list = Array.isArray(galleryDoc?.folders) ? galleryDoc.folders : [];
        return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
    }, [galleryDoc]);

    const folderMap = useMemo(() => {
        const map = new Map();
        folders.forEach((f) => map.set(f.id, f));
        return map;
    }, [folders]);

    useEffect(() => {
        return () => {
            if (activeObjectUrlRef.current) {
                URL.revokeObjectURL(activeObjectUrlRef.current);
                activeObjectUrlRef.current = null;
            }
        };
    }, []);

    // Halte selectedImg synchron, falls sich Ordner oder Datum ändern
    useEffect(() => {
        if (!selectedImg || !photos) return;
        const fresh = photos.find((p) => p.id === selectedImg.id);
        if (fresh && (fresh.folderId !== selectedImg.folderId || fresh.date !== selectedImg.date)) {
            setSelectedImg(fresh);
        }
    }, [photos, selectedImg]);

    const closeModal = () => {
        if (activeObjectUrlRef.current) {
            URL.revokeObjectURL(activeObjectUrlRef.current);
            activeObjectUrlRef.current = null;
        }
        setResolvedVideoSrc(null);
        setSelectedImg(null);
        setIsVideoBuffering(false);
    };

    const openItemModal = async (item) => {
        if (isSelectionMode) {
            toggleSelectId(item.id);
            return;
        }

        if (activeObjectUrlRef.current) {
            URL.revokeObjectURL(activeObjectUrlRef.current);
            activeObjectUrlRef.current = null;
        }

        if (!isVideoItem(item)) {
            setResolvedVideoSrc(null);
            setIsVideoBuffering(false);
            setSelectedImg(item);
            return;
        }

        setSelectedImg(item);
        setIsVideoBuffering(true);

        const cachedBlob = await getCachedVideoBlob(item.url);
        if (cachedBlob) {
            const localUrl = URL.createObjectURL(cachedBlob);
            activeObjectUrlRef.current = localUrl;
            setResolvedVideoSrc(localUrl);
            setIsVideoBuffering(false);
        } else {
            setResolvedVideoSrc(item.url);
        }
    };

    // Ordner anlegen
    const handleCreateFolder = async (e) => {
        if (e) e.preventDefault();
        const trimmed = newFolderName.trim();
        if (!trimmed) return;

        const existing = folders.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
            setActiveFolderId(existing.id);
            setNewFolderName('');
            setIsCreatingFolder(false);
            return;
        }

        const newFolder = {
            id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: trimmed,
            createdAt: new Date().toISOString()
        };

        const nextFolders = [...(galleryDoc?.folders || []), newFolder];
        await updateGalleryDoc({ folders: nextFolders });
        setNewFolderName('');
        setIsCreatingFolder(false);

        if (isSelectionMode) {
            setBatchTargetFolderId(newFolder.id);
        } else {
            setActiveFolderId(newFolder.id);
        }
    };

    // Aktuellen Ordner umbenennen
    const handleRenameActiveFolder = async (e) => {
        if (e) e.preventDefault();
        const trimmed = renameFolderValue.trim();
        if (!trimmed || activeFolderId === 'ALL' || activeFolderId === 'UNASSIGNED') return;

        const nextFolders = folders.map((f) =>
            f.id === activeFolderId ? { ...f, name: trimmed } : f
        );
        await updateGalleryDoc({ folders: nextFolders });
        setIsRenamingFolder(false);
    };

    // Aktuellen Ordner löschen (Dateien bleiben erhalten!)
    const handleDeleteActiveFolder = async () => {
        const currentFolder = folderMap.get(activeFolderId);
        if (!currentFolder) return;

        const confirmed = window.confirm(
            `Ordner „${currentFolder.name}“ löschen?\n\nHinweis: Deine Fotos und Videos werden dabei NICHT gelöscht, sondern liegen danach wieder unter „Alle“ / „Ohne Ordner“.`
        );
        if (!confirmed) return;

        const itemsInFolder = (photos || []).filter((p) => p.folderId === activeFolderId);
        for (const item of itemsInFolder) {
            await updatePhoto(item.id, { folderId: null });
        }

        const nextFolders = folders.filter((f) => f.id !== activeFolderId);
        await updateGalleryDoc({ folders: nextFolders });
        setActiveFolderId('ALL');
        setIsRenamingFolder(false);
    };

    // Einzelnes Foto/Video einem Ordner zuweisen
    const handleAssignFolderSingle = async (photoId, targetFolderId) => {
        const normalized = targetFolderId || null;
        await updatePhoto(photoId, { folderId: normalized });
    };

    // Datum eines Fotos/Videos anpassen (für chronologische Sortierung)
    const handleUpdateItemDate = async (photoItem, newDateStr) => {
        if (!photoItem || !newDateStr) return;
        const parsed = new Date(`${newDateStr}T12:00:00`);
        if (Number.isNaN(parsed.getTime())) return;
        await updatePhoto(photoItem.id, { date: parsed.toISOString() });
    };

    // Mehrfachauswahl umschalten
    const toggleSelectId = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const handleBatchMove = async () => {
        if (selectedIds.length === 0) return;
        setIsBatchMoving(true);
        try {
            const target = batchTargetFolderId === '__NONE__' ? null : (batchTargetFolderId || null);
            for (const id of selectedIds) {
                await updatePhoto(id, { folderId: target });
            }
            setSelectedIds([]);
            setIsSelectionMode(false);
            if (target) {
                setActiveFolderId(target);
            }
        } finally {
            setIsBatchMoving(false);
        }
    };

    // Datei-Upload (unterstützt Einzel- und Mehrfachauswahl + automatische Zuordnung zum aktiven Ordner)
    const handleFileChange = async (e) => {
        const fileList = Array.from(e.target.files || []);
        e.target.value = null;
        if (fileList.length === 0) return;

        const targetFolderId =
            activeFolderId !== 'ALL' && activeFolderId !== 'UNASSIGNED' && folderMap.has(activeFolderId)
                ? activeFolderId
                : null;

        for (const file of fileList) {
            const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif|gif)$/i.test(file.name);
            const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i.test(file.name);

            if (!isImage && !isVideo) {
                alert(`Datei „${file.name}“ übersprungen: Bitte nur Fotos oder Videos hochladen.`);
                continue;
            }
            await uploadFile(file, { folderId: targetFolderId });
        }
    };

    const handleReplaceFileSelected = async (e) => {
        const file = e.target.files?.[0];
        const targetItem = replaceTargetItem;
        e.target.value = null;
        setReplaceTargetItem(null);

        if (!file || !targetItem) return;
        try {
            const updated = await replaceExistingVideoWithFile(targetItem, file);
            if (updated && selectedImg?.id === targetItem.id) {
                await openItemModal(updated);
            }
        } catch (err) {
            alert('Komprimierung fehlgeschlagen: ' + err.message);
        }
    };

    const handleDelete = async (e, item, isVideo) => {
        e.stopPropagation();
        if (window.confirm(`Möchtest du dieses ${isVideo ? 'Video' : 'Foto'} wirklich löschen?`)) {
            await deleteFile(item.id, item.filePath, item.thumbPath, item.url);
            if (selectedImg?.id === item.id) closeModal();
        }
    };

    const handleOptimizeVideo = async (e, item) => {
        if (e) e.stopPropagation();
        if (!item) return;

        const cachedBlob = await getCachedVideoBlob(item.url);
        if (cachedBlob && cachedBlob.size > 0) {
            try {
                const updated = await replaceExistingVideoWithFile(item, cachedBlob);
                if (updated && selectedImg?.id === item.id) {
                    await openItemModal(updated);
                }
            } catch (err) {
                alert('Komprimierung fehlgeschlagen: ' + err.message);
            }
            return;
        }

        setReplaceTargetItem(item);
        if (replaceInputRef.current) {
            replaceInputRef.current.click();
        }
    };

    const handleVideoLoadedData = (item, videoEl) => {
        setIsVideoBuffering(false);
        if (!item || item.posterUrl || posterCapturedForIdRef.current.has(item.id) || !videoEl) return;

        try {
            const vw = videoEl.videoWidth || 960;
            const vh = videoEl.videoHeight || 540;
            const maxDim = 960;
            const scale = Math.min(1, maxDim / Math.max(vw, vh));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(vw * scale));
            canvas.height = Math.max(1, Math.round(vh * scale));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        posterCapturedForIdRef.current.add(item.id);
                        ensurePosterForExistingVideo(item, blob);
                    }
                },
                'image/jpeg',
                0.90
            );
        } catch {
            // ignore CORS
        }
    };

    const isTrulyOptimized = (p) => Boolean(p.webOptimized && (!p.sizeBytes || p.sizeBytes < 65 * 1024 * 1024));

    // Zähler für Ordner berechnen
    const folderCounts = useMemo(() => {
        const counts = { ALL: 0, UNASSIGNED: 0 };
        folders.forEach((f) => {
            counts[f.id] = 0;
        });
        (photos || []).forEach((p) => {
            counts.ALL += 1;
            if (p.folderId && folderMap.has(p.folderId)) {
                counts[p.folderId] = (counts[p.folderId] || 0) + 1;
            } else {
                counts.UNASSIGNED += 1;
            }
        });
        return counts;
    }, [photos, folders, folderMap]);

    // 1. Nach Ordner filtern
    const folderFilteredPhotos = useMemo(() => {
        const all = photos || [];
        if (activeFolderId === 'ALL') return all;
        if (activeFolderId === 'UNASSIGNED') {
            return all.filter((p) => !p.folderId || !folderMap.has(p.folderId));
        }
        return all.filter((p) => p.folderId === activeFolderId);
    }, [photos, activeFolderId, folderMap]);

    // Zähler für Medientyp im aktuellen Ordner
    const mediaTypeCounts = useMemo(() => {
        let images = 0;
        let videos = 0;
        folderFilteredPhotos.forEach((p) => {
            if (isVideoItem(p)) videos += 1;
            else images += 1;
        });
        return { all: folderFilteredPhotos.length, image: images, video: videos };
    }, [folderFilteredPhotos]);

    // 2. Nach Medientyp filtern & 3. Sortieren
    const displayedPhotos = useMemo(() => {
        const filtered = folderFilteredPhotos.filter((p) => {
            if (mediaFilter === 'image') return !isVideoItem(p);
            if (mediaFilter === 'video') return isVideoItem(p);
            return true;
        });

        return [...filtered].sort((a, b) => {
            if (sortBy === 'date-asc') {
                return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
            }
            if (sortBy === 'name-asc') {
                return (a.name || '').localeCompare(b.name || '', 'de', { numeric: true });
            }
            if (sortBy === 'size-desc') {
                return (b.sizeBytes || 0) - (a.sizeBytes || 0);
            }
            // Standard: 'date-desc' (Neueste zuerst)
            return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
        });
    }, [folderFilteredPhotos, mediaFilter, sortBy]);

    const activeFolderObj = folderMap.get(activeFolderId) || null;

    return (
        <div className="content-container fade-in">
            {/* Versteckter Datei-Dialog zum direkten lokalen Ersetzen eines alten großen Videos */}
            <input
                ref={replaceInputRef}
                type="file"
                accept="video/*"
                onChange={handleReplaceFileSelected}
                style={{ display: 'none' }}
            />

            {/* Header */}
            <div className="card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Camera className="icon-green" /> Galerie
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        {activeFolderObj
                            ? `Ordner „${activeFolderObj.name}“ • Uploads landen direkt hier`
                            : 'Fotos & Videos (1080p Full-HD • Alben & Reisen)'}
                    </p>
                </div>

                {/* Upload Button */}
                <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} />
                    <span>{activeFolderObj ? `In „${activeFolderObj.name}“ laden` : 'Foto / Video'}</span>
                    <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        accept="image/*,video/*"
                    />
                </label>
            </div>

            {/* Ordner- & Alben-Leiste */}
            <div className="card" style={{ marginBottom: '1rem', padding: '0.9rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Folder size={14} color="var(--kawasaki-green)" />
                        Ordner / Touren
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {photos && photos.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    const nextMode = !isSelectionMode;
                                    setIsSelectionMode(nextMode);
                                    setSelectedIds([]);
                                    if (nextMode && folders.length > 0 && !batchTargetFolderId) {
                                        setBatchTargetFolderId(folders[0].id);
                                    }
                                }}
                                style={{
                                    background: isSelectionMode ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(255,255,255,0.06)',
                                    border: isSelectionMode ? '1px solid var(--kawasaki-green)' : '1px solid rgba(255,255,255,0.12)',
                                    color: isSelectionMode ? 'var(--kawasaki-green)' : 'var(--text-primary)',
                                    borderRadius: '99px',
                                    padding: '5px 11px',
                                    fontSize: '0.76rem',
                                    fontWeight: '600',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                <CheckSquare size={13} />
                                {isSelectionMode ? 'Auswahl beenden' : 'Dateien zuordnen'}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsCreatingFolder((prev) => !prev)}
                            style={{
                                background: 'rgba(var(--accent-rgb), 0.14)',
                                border: '1px solid rgba(var(--accent-rgb), 0.4)',
                                color: 'var(--kawasaki-green)',
                                borderRadius: '99px',
                                padding: '5px 11px',
                                fontSize: '0.76rem',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            <FolderPlus size={13} />
                            Neuer Ordner
                        </button>
                    </div>
                </div>

                {/* Formular zum Anlegen eines neuen Ordners (z. B. Schwedenreise, Gardasee) */}
                {isCreatingFolder && (
                    <form
                        onSubmit={handleCreateFolder}
                        style={{
                            display: 'flex',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            background: 'rgba(0,0,0,0.28)',
                            padding: '0.6rem',
                            borderRadius: '10px',
                            border: '1px solid rgba(var(--accent-rgb), 0.3)',
                            flexWrap: 'wrap'
                        }}
                    >
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Ordnername, z. B. Schwedenreise oder Gardasee..."
                            autoFocus
                            style={{
                                flex: '1 1 200px',
                                background: 'var(--anthracite-900)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '8px',
                                padding: '8px 11px',
                                color: '#fff',
                                fontSize: '0.86rem'
                            }}
                        />
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ padding: '8px 14px', fontSize: '0.82rem', borderRadius: '8px' }}
                        >
                            Anlegen
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreatingFolder(false);
                                setNewFolderName('');
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                color: 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            Abbrechen
                        </button>
                    </form>
                )}

                {/* Ordner-Tabs */}
                <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '2px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveFolderId('ALL');
                            setIsRenamingFolder(false);
                        }}
                        style={{
                            background: activeFolderId === 'ALL' ? 'var(--kawasaki-green)' : 'rgba(255,255,255,0.06)',
                            color: activeFolderId === 'ALL' ? '#000' : 'var(--text-primary)',
                            border: activeFolderId === 'ALL' ? '1px solid var(--kawasaki-green)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '99px',
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: activeFolderId === 'ALL' ? '700' : '500',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Alle ({folderCounts.ALL})
                    </button>

                    {folders.map((folder) => {
                        const isActive = activeFolderId === folder.id;
                        const count = folderCounts[folder.id] || 0;
                        return (
                            <button
                                key={folder.id}
                                type="button"
                                onClick={() => {
                                    setActiveFolderId(folder.id);
                                    setIsRenamingFolder(false);
                                }}
                                style={{
                                    background: isActive ? 'var(--kawasaki-green)' : 'rgba(255,255,255,0.06)',
                                    color: isActive ? '#000' : 'var(--text-primary)',
                                    border: isActive ? '1px solid var(--kawasaki-green)' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '99px',
                                    padding: '6px 12px',
                                    fontSize: '0.8rem',
                                    fontWeight: isActive ? '700' : '500',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {isActive ? <FolderOpen size={14} /> : <Folder size={14} color="var(--kawasaki-green)" />}
                                {folder.name} ({count})
                            </button>
                        );
                    })}

                    {folders.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setActiveFolderId('UNASSIGNED');
                                setIsRenamingFolder(false);
                            }}
                            style={{
                                background: activeFolderId === 'UNASSIGNED' ? 'var(--kawasaki-green)' : 'rgba(255,255,255,0.04)',
                                color: activeFolderId === 'UNASSIGNED' ? '#000' : 'var(--text-secondary)',
                                border: activeFolderId === 'UNASSIGNED' ? '1px solid var(--kawasaki-green)' : '1px dashed rgba(255,255,255,0.16)',
                                borderRadius: '99px',
                                padding: '6px 12px',
                                fontSize: '0.78rem',
                                fontWeight: activeFolderId === 'UNASSIGNED' ? '700' : '500',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Ohne Ordner ({folderCounts.UNASSIGNED})
                        </button>
                    )}
                </div>

                {/* Aktiver Ordner: Umbenennen / Löschen */}
                {activeFolderObj && (
                    <div style={{
                        marginTop: '0.7rem',
                        paddingTop: '0.65rem',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        {isRenamingFolder ? (
                            <form onSubmit={handleRenameActiveFolder} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
                                <input
                                    type="text"
                                    value={renameFolderValue}
                                    onChange={(e) => setRenameFolderValue(e.target.value)}
                                    autoFocus
                                    style={{
                                        background: 'var(--anthracite-900)',
                                        border: '1px solid var(--kawasaki-green)',
                                        borderRadius: '6px',
                                        padding: '5px 9px',
                                        color: '#fff',
                                        fontSize: '0.82rem',
                                        flex: '1 1 160px'
                                    }}
                                />
                                <button type="submit" className="btn-primary" style={{ padding: '5px 11px', fontSize: '0.76rem', borderRadius: '6px' }}>
                                    Speichern
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsRenamingFolder(false)}
                                    style={{ background: 'rgba(255,255,255,0.08)', color: '#ccc', border: 'none', borderRadius: '6px', padding: '5px 9px', fontSize: '0.76rem' }}
                                >
                                    Abbrechen
                                </button>
                            </form>
                        ) : (
                            <>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Aktiver Ordner: <strong style={{ color: '#fff' }}>{activeFolderObj.name}</strong> ({folderCounts[activeFolderObj.id] || 0} Dateien)
                                </span>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRenameFolderValue(activeFolderObj.name);
                                            setIsRenamingFolder(true);
                                        }}
                                        style={{
                                            background: 'rgba(255,255,255,0.06)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            padding: '4px 9px',
                                            fontSize: '0.74rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Edit3 size={12} /> Umbenennen
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteActiveFolder}
                                        style={{
                                            background: 'rgba(255, 70, 70, 0.1)',
                                            color: '#ff6b6b',
                                            border: '1px solid rgba(255, 70, 70, 0.25)',
                                            borderRadius: '6px',
                                            padding: '4px 9px',
                                            fontSize: '0.74rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={12} /> Ordner auflösen
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Mehrfach-Auswahl-Leiste (Dateien in Ordner verschieben) */}
            {isSelectionMode && (
                <div className="card" style={{
                    marginBottom: '1rem',
                    padding: '0.85rem 1rem',
                    background: 'rgba(var(--accent-rgb), 0.1)',
                    border: '1px solid rgba(var(--accent-rgb), 0.4)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.65rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--kawasaki-green)' }}>
                            {selectedIds.length} {selectedIds.length === 1 ? 'Datei' : 'Dateien'} ausgewählt
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                if (selectedIds.length === displayedPhotos.length) {
                                    setSelectedIds([]);
                                } else {
                                    setSelectedIds(displayedPhotos.map((p) => p.id));
                                }
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                color: '#ddd',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '6px',
                                padding: '4px 9px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            {selectedIds.length === displayedPhotos.length ? 'Auswahl aufheben' : 'Alle angezeigten wählen'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                            value={batchTargetFolderId}
                            onChange={(e) => setBatchTargetFolderId(e.target.value)}
                            style={{
                                background: 'var(--anthracite-900)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                fontSize: '0.82rem'
                            }}
                        >
                            <option value="">-- Ziel-Ordner wählen --</option>
                            {folders.map((f) => (
                                <option key={f.id} value={f.id}>
                                    📁 {f.name}
                                </option>
                            ))}
                            <option value="__NONE__">Ohne Ordner (aus Ordner entfernen)</option>
                        </select>

                        <button
                            type="button"
                            disabled={selectedIds.length === 0 || !batchTargetFolderId || isBatchMoving}
                            onClick={handleBatchMove}
                            className="btn-primary"
                            style={{
                                padding: '6px 14px',
                                fontSize: '0.82rem',
                                borderRadius: '8px',
                                opacity: selectedIds.length === 0 || !batchTargetFolderId ? 0.5 : 1
                            }}
                        >
                            {isBatchMoving ? 'Verschiebe...' : 'In Ordner packen'}
                        </button>
                    </div>
                </div>
            )}

            {/* Filter- (Fotos / Videos) & Sortier-Leiste */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                gap: '0.6rem',
                flexWrap: 'wrap'
            }}>
                {/* Medientyp-Pills */}
                <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[
                        { key: 'all', label: `Alle (${mediaTypeCounts.all})` },
                        { key: 'image', label: `Fotos (${mediaTypeCounts.image})` },
                        { key: 'video', label: `Videos (${mediaTypeCounts.video})` }
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setMediaFilter(tab.key)}
                            style={{
                                background: mediaFilter === tab.key ? 'rgba(var(--accent-rgb), 0.2)' : 'transparent',
                                color: mediaFilter === tab.key ? 'var(--kawasaki-green)' : 'var(--text-secondary)',
                                border: mediaFilter === tab.key ? '1px solid rgba(var(--accent-rgb), 0.4)' : '1px solid transparent',
                                borderRadius: '7px',
                                padding: '5px 10px',
                                fontSize: '0.76rem',
                                fontWeight: mediaFilter === tab.key ? '700' : '500',
                                cursor: 'pointer'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Sortierung */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowUpDown size={14} color="var(--kawasaki-green)" />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sortierung"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--text-primary)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '8px',
                            padding: '5px 10px',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="date-desc">Sortierung: Neueste zuerst</option>
                        <option value="date-asc">Sortierung: Älteste zuerst (Chronologisch)</option>
                        <option value="name-asc">Sortierung: Name (A – Z)</option>
                        <option value="size-desc">Sortierung: Größe (Größte zuerst)</option>
                    </select>
                </div>
            </div>

            {/* Progress Bar */}
            {isUploading && (
                <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.88rem', gap: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Loader2 size={15} className="spin-icon" color="var(--kawasaki-green)" />
                            {statusText || 'Verarbeite'} ({Math.round(progress)}%)...
                        </span>
                        {bytesInfo?.total > 0 && (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {formatMB(bytesInfo.transferred)} / {formatMB(bytesInfo.total)}
                            </span>
                        )}
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--anthracite-700)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--metal-400), var(--kawasaki-green))',
                            borderRadius: '99px',
                            transition: 'width 0.15s linear'
                        }}></div>
                    </div>
                </div>
            )}

            {/* Media Grid */}
            <div className="photo-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '1rem'
            }}>
                {!photosLoading && displayedPhotos.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
                        <ImageIcon size={44} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                        <p style={{ margin: '0 0 0.25rem 0' }}>
                            {activeFolderObj
                                ? `Noch keine Aufnahmen im Ordner „${activeFolderObj.name}“.`
                                : 'Keine passenden Fotos oder Videos gefunden.'}
                        </p>
                        <p style={{ fontSize: '0.8rem', margin: 0 }}>
                            {activeFolderObj
                                ? 'Lade direkt oben Dateien hoch oder ordne vorhandene Bilder über „Dateien zuordnen“ diesem Ordner zu.'
                                : 'Lade jetzt deine erste Aufnahme hoch oder wechsle den Filter!'}
                        </p>
                    </div>
                )}

                {displayedPhotos.map((photo) => {
                    const isVideo = isVideoItem(photo);
                    const isSelected = selectedIds.includes(photo.id);
                    const itemFolder = photo.folderId ? folderMap.get(photo.folderId) : null;

                    return (
                        <div
                            key={photo.id}
                            className="photo-item"
                            onClick={() => openItemModal(photo)}
                            style={{
                                position: 'relative',
                                aspectRatio: '1',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: isSelected
                                    ? '2.5px solid var(--kawasaki-green)'
                                    : '1px solid rgba(255,255,255,0.1)',
                                background: 'var(--anthracite-850)',
                                transform: isSelected ? 'scale(0.97)' : 'none',
                                transition: 'transform 0.15s ease, border-color 0.15s ease'
                            }}
                        >
                            {isVideo ? (
                                <>
                                    {photo.posterUrl ? (
                                        <img
                                            src={photo.posterUrl}
                                            alt={photo.name || 'Video'}
                                            loading="lazy"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <video
                                            src={`${photo.url}#t=0.001`}
                                            muted
                                            playsInline
                                            preload="metadata"
                                            onLoadedData={(e) => handleVideoLoadedData(photo, e.currentTarget)}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}

                                    {/* Play Icon Overlay */}
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.22)',
                                        pointerEvents: 'none'
                                    }}>
                                        <div style={{
                                            width: '42px',
                                            height: '42px',
                                            borderRadius: '50%',
                                            background: 'rgba(var(--accent-rgb), 0.92)',
                                            color: '#000',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                        }}>
                                            <Play size={20} fill="#000" style={{ marginLeft: '2px' }} />
                                        </div>
                                    </div>

                                    {/* Video Badge */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        left: '8px',
                                        background: 'rgba(0,0,0,0.72)',
                                        color: 'var(--kawasaki-green)',
                                        padding: '3px 6px',
                                        borderRadius: '6px',
                                        fontSize: '0.65rem',
                                        fontWeight: '700',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backdropFilter: 'blur(4px)',
                                        pointerEvents: 'none',
                                        zIndex: 2
                                    }}>
                                        <Film size={11} />
                                        {isTrulyOptimized(photo)
                                            ? `Full-HD${photo.sizeBytes ? ` • ${formatMB(photo.sizeBytes)}` : ''}`
                                            : `Video${photo.sizeBytes ? ` (${formatMB(photo.sizeBytes)})` : ''}`}
                                    </div>
                                </>
                            ) : (
                                <img
                                    src={photo.url}
                                    alt={photo.name || 'Foto'}
                                    loading="lazy"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                />
                            )}

                            {/* Overlay Gradient */}
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.82), transparent)',
                                pointerEvents: 'none'
                            }} />

                            {/* Datum unten rechts (bei Fotos unten links/rechts) */}
                            {photo.date && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '8px',
                                    right: '8px',
                                    fontSize: '0.64rem',
                                    color: 'rgba(255,255,255,0.82)',
                                    background: 'rgba(0,0,0,0.55)',
                                    padding: '2px 5px',
                                    borderRadius: '5px',
                                    pointerEvents: 'none',
                                    zIndex: 2
                                }}>
                                    {formatShortDate(photo.date)}
                                </div>
                            )}

                            {/* Oben links: Auswahl-Checkbox (im Auswahlmodus) ODER Ordner-Schnellzuordnung */}
                            {isSelectionMode ? (
                                <div style={{
                                    position: 'absolute',
                                    top: '8px',
                                    left: '8px',
                                    background: isSelected ? 'var(--kawasaki-green)' : 'rgba(0,0,0,0.65)',
                                    color: isSelected ? '#000' : '#fff',
                                    borderRadius: '6px',
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                                }}>
                                    {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                                </div>
                            ) : (
                                folders.length > 0 && (
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            left: '8px',
                                            maxWidth: 'calc(100% - 52px)'
                                        }}
                                    >
                                        <select
                                            value={photo.folderId && folderMap.has(photo.folderId) ? photo.folderId : ''}
                                            onChange={(e) => handleAssignFolderSingle(photo.id, e.target.value)}
                                            title="Ordner zuweisen"
                                            style={{
                                                background: itemFolder ? 'rgba(var(--accent-rgb), 0.88)' : 'rgba(0,0,0,0.62)',
                                                color: itemFolder ? '#000' : '#ddd',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '3px 6px',
                                                fontSize: '0.66rem',
                                                fontWeight: '700',
                                                maxWidth: '100%',
                                                cursor: 'pointer',
                                                backdropFilter: 'blur(4px)'
                                            }}
                                        >
                                            <option value="" style={{ background: 'var(--anthracite-850)', color: '#fff' }}>
                                                📁 Ordner...
                                            </option>
                                            {folders.map((f) => (
                                                <option key={f.id} value={f.id} style={{ background: 'var(--anthracite-850)', color: '#fff' }}>
                                                    📁 {f.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )
                            )}

                            {/* Delete Button */}
                            {!isSelectionMode && (
                                <button
                                    onClick={(e) => handleDelete(e, photo, isVideo)}
                                    style={{
                                        position: 'absolute', top: '8px', right: '8px',
                                        background: 'rgba(0,0,0,0.6)', color: 'white',
                                        border: 'none', borderRadius: '50%',
                                        width: '30px', height: '30px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', backdropFilter: 'blur(4px)'
                                    }}>
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal for Fullscreen View */}
            {selectedImg && (
                <div
                    className="modal-backdrop"
                    onClick={closeModal}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: '1rem',
                        animation: 'fadeIn 0.2s ease-out',
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '960px',
                            maxHeight: '88vh',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isVideoItem(selectedImg) ? (
                            <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {isVideoBuffering && (
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        color: 'var(--kawasaki-green)',
                                        zIndex: 2,
                                        pointerEvents: 'none'
                                    }}>
                                        <Loader2 size={36} className="spin-icon" />
                                        <span style={{ fontSize: '0.8rem', color: '#ccc', background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: '99px' }}>
                                            Lade 1080p Full-HD Stream...
                                        </span>
                                    </div>
                                )}
                                {resolvedVideoSrc && (
                                    <video
                                        key={resolvedVideoSrc}
                                        ref={playerRef}
                                        src={resolvedVideoSrc}
                                        poster={selectedImg.posterUrl || undefined}
                                        controls
                                        autoPlay
                                        playsInline
                                        preload="auto"
                                        onCanPlay={() => setIsVideoBuffering(false)}
                                        onPlaying={() => setIsVideoBuffering(false)}
                                        onWaiting={() => setIsVideoBuffering(true)}
                                        onLoadedData={(e) => handleVideoLoadedData(selectedImg, e.currentTarget)}
                                        style={{
                                            width: '100%',
                                            maxHeight: '72vh',
                                            borderRadius: '12px',
                                            boxShadow: '0 0 28px rgba(0,0,0,0.8)',
                                            background: '#000',
                                            objectFit: 'contain'
                                        }}
                                    />
                                )}
                            </div>
                        ) : (
                            <img
                                src={selectedImg.url}
                                alt="Full view"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '74vh',
                                    borderRadius: '8px',
                                    boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                                }}
                            />
                        )}

                        {/* Untere Leiste im Modal: Ordner-Zuordnung, Datum & Video-Status */}
                        <div style={{
                            marginTop: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.65rem',
                            flexWrap: 'wrap',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '0.55rem 0.9rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            {isVideoItem(selectedImg) && (
                                !isTrulyOptimized(selectedImg) ? (
                                    <button
                                        type="button"
                                        disabled={isUploading}
                                        onClick={(e) => handleOptimizeVideo(e, selectedImg)}
                                        style={{
                                            background: 'var(--kawasaki-green)',
                                            color: '#000',
                                            fontWeight: '700',
                                            fontSize: '0.78rem',
                                            padding: '6px 12px',
                                            borderRadius: '99px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        {isOptimizingId === selectedImg.id ? (
                                            <>
                                                <Loader2 size={14} className="spin-icon" />
                                                {statusText || 'Optimiere...'} ({Math.round(progress)}%)
                                            </>
                                        ) : (
                                            <>
                                                <Zap size={14} />
                                                Originaldatei wählen & als Full-HD ersetzen
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <span style={{
                                        fontSize: '0.78rem',
                                        color: 'var(--kawasaki-green)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontWeight: '600'
                                    }}>
                                        <CheckCircle2 size={14} />
                                        1080p Full-HD{selectedImg.sizeBytes ? ` (${formatMB(selectedImg.sizeBytes)})` : ''}
                                    </span>
                                )
                            )}

                            {/* Ordner-Auswahl im Modal */}
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#ccc' }}>
                                <Folder size={14} color="var(--kawasaki-green)" />
                                <select
                                    value={selectedImg.folderId && folderMap.has(selectedImg.folderId) ? selectedImg.folderId : ''}
                                    onChange={(e) => handleAssignFolderSingle(selectedImg.id, e.target.value)}
                                    style={{
                                        background: 'var(--anthracite-900)',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '6px',
                                        padding: '4px 8px',
                                        fontSize: '0.78rem'
                                    }}
                                >
                                    <option value="">Kein Ordner</option>
                                    {folders.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {/* Datum bearbeiten (für zeitliche Einordnung von Reisen) */}
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#ccc' }} title="Aufnahmedatum anpassen">
                                <Calendar size={14} color="var(--kawasaki-green)" />
                                <input
                                    type="date"
                                    value={toDateInputValue(selectedImg.date)}
                                    onChange={(e) => handleUpdateItemDate(selectedImg, e.target.value)}
                                    style={{
                                        background: 'var(--anthracite-900)',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '6px',
                                        padding: '3px 7px',
                                        fontSize: '0.76rem'
                                    }}
                                />
                            </label>
                        </div>

                        <button
                            onClick={closeModal}
                            style={{
                                position: 'absolute', top: '-42px', right: 0,
                                background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none',
                                borderRadius: '50%', width: '36px', height: '36px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gallery;
