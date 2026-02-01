import React, { useState } from 'react';
import { Camera, Trash2, X, Plus, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { useStorage } from '../hooks/useStorage';

const Gallery = () => {
    const { data: photos, loading: photosLoading } = useCollection('photos');
    const { uploadFile, deleteFile, isUploading, progress } = useStorage();
    const [selectedImg, setSelectedImg] = useState(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate type
            if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
                alert('Bitte nur Bilder hochladen (PNG, JPG, WEBP)');
                return;
            }
            // Upload
            await uploadFile(file);
            // Reset input
            e.target.value = null;
        }
    };

    const handleDelete = async (e, id, filePath) => {
        e.stopPropagation(); // Prevent opening modal
        if (window.confirm('Möchtest du dieses Foto wirklich löschen?')) {
            await deleteFile(id, filePath);
            if (selectedImg?.id === id) setSelectedImg(null);
        }
    };

    return (
        <div className="content-container fade-in">
            {/* Header */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Camera className="icon-green" /> Galerie
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Deine schönsten Momente
                    </p>
                </div>

                {/* Upload Button */}
                <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} />
                    <span>Foto</span>
                    <input type="file" onChange={handleFileChange} style={{ display: 'none' }} accept="image/*" />
                </label>
            </div>

            {/* Progress Bar */}
            {isUploading && (
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                    <p style={{ marginBottom: '0.5rem' }}>Lade hoch ({Math.round(progress)}%)...</p>
                    <div style={{ width: '100%', height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--kawasaki-green)', transition: 'width 0.2s' }}></div>
                    </div>
                </div>
            )}

            {/* Photo Grid */}
            <div className="photo-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '1rem'
            }}>
                {!photosLoading && photos.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <ImageIcon size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>Noch keine Fotos.</p>
                        <p style={{ fontSize: '0.8rem' }}>Lade jetzt dein erstes Bild hoch!</p>
                    </div>
                )}

                {photos && photos.map(photo => (
                    <div key={photo.id}
                        className="photo-item"
                        onClick={() => setSelectedImg(photo)}
                        style={{
                            position: 'relative',
                            aspectRatio: '1',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: '#222'
                        }}>
                        <img src={photo.url} alt="Gallery" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} />

                        {/* Overlay Gradient for better text visibility (date) */}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                            pointerEvents: 'none'
                        }} />

                        {/* Delete Button */}
                        <button
                            onClick={(e) => handleDelete(e, photo.id, photo.filePath)}
                            style={{
                                position: 'absolute', top: '8px', right: '8px',
                                background: 'rgba(0,0,0,0.6)', color: 'white',
                                border: 'none', borderRadius: '50%',
                                width: '32px', height: '32px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', backdropFilter: 'blur(4px)'
                            }}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal for Fullscreen View */}
            {selectedImg && (
                <div
                    className="modal-backdrop"
                    onClick={() => setSelectedImg(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: '1rem',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
                        <img
                            src={selectedImg.url}
                            alt="Full view"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '90vh',
                                borderRadius: '8px',
                                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                            }}
                        />
                        <button
                            onClick={() => setSelectedImg(null)}
                            style={{
                                position: 'absolute', top: '-40px', right: 0,
                                background: 'transparent', color: 'white', border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={32} />
                        </button>
                        <div style={{
                            position: 'absolute', bottom: '-30px', left: 0, right: 0, textAlign: 'center', color: '#999', fontSize: '0.9rem'
                        }}>
                            {new Date(selectedImg.date).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gallery;
