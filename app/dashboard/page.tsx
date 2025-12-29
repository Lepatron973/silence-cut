'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function Dashboard() {
    // State Management
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [processingState, setProcessingState] = useState<'upload' | 'processing' | 'download'>('upload');
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('Initialisation du traitement...');
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Constants
    const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250MB in bytes

    // Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    };

    const handleFileSelection = (file: File) => {
        // Validate file type
        if (file.type !== 'video/mp4') {
            showError('Format de fichier invalide. Veuillez sélectionner un fichier MP4.');
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            showError(`La taille du fichier dépasse la limite de 250 MB. Taille actuelle : ${formatFileSize(file.size)}`);
            return;
        }

        // Store file and update UI
        setSelectedFile(file);
        setError(null);
    };

    const removeFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const [videoId, setVideoId] = useState<string | null>(null);
    const [processingResult, setProcessingResult] = useState<any>(null);

    const startProcessing = async () => {
        if (!selectedFile) return;

        try {
            setProcessingState('processing');
            setError(null);
            setProgress(0);
            setProgressStatus('Upload de la vidéo...');

            // Step 1: Upload video
            const formData = new FormData();
            formData.append('video', selectedFile);

            const uploadResponse = await fetch('/api/videos/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Échec de l\'upload');
            }

            const uploadData = await uploadResponse.json();
            const newVideoId = uploadData.videoId;
            setVideoId(newVideoId);

            setProgress(10);
            setProgressStatus('Démarrage du traitement...');

            // Step 2: Start processing
            const processResponse = await fetch(`/api/videos/${newVideoId}/process`, {
                method: 'POST',
            });

            if (!processResponse.ok) {
                const errorData = await processResponse.json();
                throw new Error(errorData.error || 'Échec du démarrage du traitement');
            }

            // Step 3: Poll for status
            pollProcessingStatus(newVideoId);

        } catch (error: any) {
            console.error('Processing error:', error);
            showError(error.message || 'Une erreur est survenue lors du traitement');
            setProcessingState('upload');
        }
    };

    const pollProcessingStatus = async (id: string) => {
        const pollInterval = setInterval(async () => {
            try {
                const statusResponse = await fetch(`/api/videos/${id}/status`);

                if (!statusResponse.ok) {
                    clearInterval(pollInterval);
                    showError('Erreur lors de la récupération du statut');
                    setProcessingState('upload');
                    return;
                }

                const statusData = await statusResponse.json();

                // Update progress
                setProgress(statusData.progress || 0);
                setProgressStatus(statusData.message || 'Traitement en cours...');

                // Update step indicators
                if (statusData.progress >= 10) setCompletedSteps(prev => prev.includes(2) ? prev : [...prev, 2]);
                if (statusData.progress >= 50) setCompletedSteps(prev => prev.includes(3) ? prev : [...prev, 3]);
                if (statusData.progress >= 90) setCompletedSteps(prev => prev.includes(4) ? prev : [...prev, 4]);

                // Check if completed
                if (statusData.status === 'completed') {
                    clearInterval(pollInterval);
                    setProgress(100);
                    setProcessingResult(statusData.result);
                    setProcessingState('download');
                } else if (statusData.status === 'failed') {
                    clearInterval(pollInterval);
                    showError(statusData.error || 'Le traitement a échoué');
                    setProcessingState('upload');
                }
            } catch (error: any) {
                clearInterval(pollInterval);
                console.error('Status polling error:', error);
                showError('Erreur lors de la vérification du statut');
                setProcessingState('upload');
            }
        }, 2000); // Poll every 2 seconds

        // Store interval ref for cleanup
        processingIntervalRef.current = pollInterval;
    };

    const resetToUploadState = async () => {
        // Delete video from backend if exists
        if (videoId) {
            try {
                await fetch(`/api/videos/${videoId}`, {
                    method: 'DELETE',
                });
            } catch (error) {
                console.error('Delete error:', error);
            }
        }

        setProcessingState('upload');
        setSelectedFile(null);
        setVideoId(null);
        setProcessingResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setProgress(0);
        setProgressStatus('Initialisation du traitement...');
        setCompletedSteps([]);
        if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
    };

    const handleDownload = () => {
        if (!videoId) return;

        // Direct download from backend
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
        window.open(`${API_URL}/api/videos/${videoId}/download`, '_blank');
    };

    const showError = (message: string) => {
        setError(message);
        setTimeout(() => {
            setError(null);
        }, 8000);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
        };
    }, []);

    return (
        <div className="bg-background min-h-screen">
            {/* Header Section */}
            <header className="bg-surface border-b border-border sticky top-0 z-navigation z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="40" height="40" rx="8" fill="#2D5A3D" />
                                <path d="M12 20L18 14L24 20L30 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M12 26L18 20L24 26L30 20" stroke="#E67E22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div>
                                <h1 className="text-xl font-heading font-bold text-primary">SilenceCut</h1>
                                <p className="text-xs text-text-secondary font-caption">Optimisation Vidéo Intelligente</p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="hidden md:flex items-center gap-6">
                            <a href="#" className="text-text-secondary hover:text-primary transition-base font-medium">Accueil</a>
                            <a href="#" className="text-text-secondary hover:text-primary transition-base font-medium">Fonctionnalités</a>
                            <a href="#" className="text-text-secondary hover:text-primary transition-base font-medium">Tarifs</a>
                            <a href="#" className="text-text-secondary hover:text-primary transition-base font-medium">Support</a>
                        </nav>

                        {/* Mobile Menu Button */}
                        <button className="md:hidden text-text-primary hover:text-primary transition-base touch-target" aria-label="Menu de navigation">
                            <i className="fas fa-bars text-xl"></i>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Ad Column (Desktop Only) */}
                    <aside className="hidden lg:block lg:col-span-2 space-y-6" id="leftAdColumn">
                        <div className="card bg-gradient-to-br from-primary-50 to-secondary-50 border-2 border-dashed border-primary-200 min-h-[400px] flex flex-col items-center justify-center text-center p-6">
                            <i className="fas fa-ad text-4xl text-primary-300 mb-3"></i>
                            <p className="text-sm text-text-secondary font-caption">Espace Publicitaire</p>
                            <p className="text-xs text-text-tertiary mt-1">300 × 600</p>
                        </div>
                        <div className="card bg-gradient-to-br from-accent-50 to-primary-50 border-2 border-dashed border-accent-200 min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                            <i className="fas fa-rectangle-ad text-3xl text-accent-300 mb-3"></i>
                            <p className="text-sm text-text-secondary font-caption">Publicité</p>
                            <p className="text-xs text-text-tertiary mt-1">300 × 250</p>
                        </div>
                    </aside>

                    {/* Main Content Column */}
                    <section className="lg:col-span-8">
                        {/* Hero Section */}
                        <div className="text-center mb-8 lg:mb-12">
                            <h2 className="text-3xl lg:text-4xl font-heading font-bold text-primary mb-4">
                                Supprimez les Silences Automatiquement
                            </h2>
                            <p className="text-lg text-text-secondary mx-auto px-4">
                                Téléchargez votre vidéo, notre IA détecte et supprime les silences, puis téléchargez le résultat optimisé en quelques instants.
                            </p>
                        </div>

                        {/* Processing Card */}
                        <div className="card card-hover bg-white shadow-lg">

                            {/* Upload State */}
                            {processingState === 'upload' && (
                                <div className="space-y-6">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`border-3 border-dashed rounded-xl p-12 text-center transition-all duration-250 cursor-pointer ${isDragging
                                            ? 'border-primary-500 bg-primary-50'
                                            : 'border-primary-300 bg-primary-50/30 hover:border-primary-500 hover:bg-primary-50/50'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                                                <i className="fas fa-cloud-upload-alt text-4xl text-primary"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-heading font-semibold text-primary mb-2">
                                                    Glissez-déposez votre vidéo ici
                                                </h3>
                                                <p className="text-text-secondary mb-4">
                                                    ou cliquez pour parcourir vos fichiers
                                                </p>
                                                <p className="text-sm text-text-tertiary">
                                                    Format accepté : MP4 • Taille maximale : 250 MB
                                                </p>
                                            </div>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                accept="video/mp4"
                                                className="hidden"
                                                onChange={handleFileInputChange}
                                            />
                                            <button type="button" className="btn btn-primary">
                                                <i className="fas fa-folder-open mr-2"></i>
                                                Parcourir les fichiers
                                            </button>
                                        </div>
                                    </div>

                                    {/* File Info */}
                                    {selectedFile && (
                                        <div className="bg-surface rounded-lg p-4 border border-border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                        <i className="fas fa-file-video text-xl text-primary"></i>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-text-primary truncate-filename">{selectedFile.name}</p>
                                                        <p className="text-sm text-text-secondary">{formatFileSize(selectedFile.size)}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={removeFile}
                                                    className="btn-ghost text-error hover:bg-error-light ml-4 touch-target"
                                                    aria-label="Supprimer le fichier"
                                                >
                                                    <i className="fas fa-times text-xl"></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={startProcessing}
                                        disabled={!selectedFile}
                                        className="btn btn-accent w-full"
                                    >
                                        <i className="fas fa-rocket mr-2"></i>
                                        Commencer le traitement
                                    </button>

                                    {/* Features List */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-border">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-success-light rounded-lg flex items-center justify-center flex-shrink-0">
                                                <i className="fas fa-bolt text-success"></i>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-text-primary text-sm">Rapide</h4>
                                                <p className="text-xs text-text-secondary">Traitement en quelques minutes</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-info-light rounded-lg flex items-center justify-center flex-shrink-0">
                                                <i className="fas fa-brain text-info"></i>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-text-primary text-sm">Intelligent</h4>
                                                <p className="text-xs text-text-secondary">Détection IA des silences</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-warning-light rounded-lg flex items-center justify-center flex-shrink-0">
                                                <i className="fas fa-shield-alt text-warning"></i>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-text-primary text-sm">Sécurisé</h4>
                                                <p className="text-xs text-text-secondary">Vos données protégées</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Processing State */}
                            {processingState === 'processing' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <div className="w-24 h-24 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                            <i className="fas fa-cog fa-spin text-5xl text-accent"></i>
                                        </div>
                                        <h3 className="text-2xl font-heading font-semibold text-primary mb-3">
                                            Traitement en cours...
                                        </h3>
                                        <p className="text-text-secondary mb-6">
                                            Notre IA analyse votre vidéo et supprime les silences. Cela peut prendre quelques instants.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-text-secondary font-medium">Progression</span>
                                            <span className="text-accent font-semibold">{progress}%</span>
                                        </div>
                                        <div className="progress-bar h-3">
                                            <div className="progress-bar-fill bg-gradient-to-r from-accent to-accent-600" style={{ width: `${progress}%` }}></div>
                                        </div>
                                        <p className="text-sm text-text-tertiary text-center">{progressStatus}</p>
                                    </div>

                                    <div className="bg-surface rounded-lg p-6 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                                                <i className="fas fa-check text-white text-sm"></i>
                                            </div>
                                            <p className="text-sm text-text-primary">Téléchargement de la vidéo</p>
                                        </div>
                                        {[
                                            { id: 2, label: 'Analyse audio et détection des silences' },
                                            { id: 3, label: 'Suppression et optimisation' },
                                            { id: 4, label: 'Finalisation de la vidéo' }
                                        ].map((step) => {
                                            const isCompleted = completedSteps.includes(step.id);
                                            return (
                                                <div key={step.id} className={`flex items-center gap-3 ${isCompleted ? '' : 'opacity-50'}`}>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-success' : 'bg-text-disabled'}`}>
                                                        <i className={`fas ${isCompleted ? 'fa-check text-sm' : 'fa-circle text-xs'} text-white`}></i>
                                                    </div>
                                                    <p className="text-sm text-text-secondary">{step.label}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Download State */}
                            {processingState === 'download' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <div className="w-24 h-24 bg-success-light rounded-full flex items-center justify-center mx-auto mb-6">
                                            <i className="fas fa-check-circle text-5xl text-success"></i>
                                        </div>
                                        <h3 className="text-2xl font-heading font-semibold text-primary mb-3">
                                            Traitement terminé !
                                        </h3>
                                        <p className="text-text-secondary mb-6">
                                            Votre vidéo optimisée est prête. Les silences ont été supprimés avec succès.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 bg-surface rounded-lg p-6">
                                        <div className="text-center">
                                            <p className="text-3xl font-heading font-bold text-primary mb-1">
                                                {processingResult?.percentageSaved?.toFixed(0) || 0}%
                                            </p>
                                            <p className="text-sm text-text-secondary">Temps économisé</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-3xl font-heading font-bold text-accent mb-1">
                                                {processingResult?.finalDuration
                                                    ? `${Math.floor(processingResult.finalDuration / 60)}:${Math.floor(processingResult.finalDuration % 60).toString().padStart(2, '0')}`
                                                    : '0:00'
                                                }
                                            </p>
                                            <p className="text-sm text-text-secondary">Durée finale</p>
                                        </div>
                                    </div>

                                    <button type="button" className="btn btn-primary w-full" onClick={handleDownload}>
                                        <i className="fas fa-download mr-2"></i>
                                        Télécharger la vidéo optimisée
                                    </button>

                                    <button type="button" className="btn btn-outline w-full" onClick={resetToUploadState}>
                                        <i className="fas fa-redo mr-2"></i>
                                        Traiter une nouvelle vidéo
                                    </button>

                                    <div className="pt-6 border-t border-border">
                                        <p className="text-sm text-text-secondary text-center mb-4">Partager votre expérience</p>
                                        <div className="flex items-center justify-center gap-3">
                                            <button type="button" className="w-12 h-12 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg transition-base flex items-center justify-center touch-target">
                                                <i className="fab fa-facebook-f text-lg"></i>
                                            </button>
                                            <button type="button" className="w-12 h-12 bg-[#1DA1F2] hover:bg-[#1A91DA] text-white rounded-lg transition-base flex items-center justify-center touch-target">
                                                <i className="fab fa-twitter text-lg"></i>
                                            </button>
                                            <button type="button" className="w-12 h-12 bg-[#0A66C2] hover:bg-[#095196] text-white rounded-lg transition-base flex items-center justify-center touch-target">
                                                <i className="fab fa-linkedin-in text-lg"></i>
                                            </button>
                                            <button type="button" className="w-12 h-12 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg transition-base flex items-center justify-center touch-target">
                                                <i className="fab fa-whatsapp text-lg"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error Alert */}
                            {error && (
                                <div className="mt-6 bg-error-light border-l-4 border-error rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <i className="fas fa-exclamation-circle text-error text-xl flex-shrink-0 mt-0.5"></i>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-error mb-1">Erreur de traitement</h4>
                                            <p className="text-sm text-text-primary">{error}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setError(null)}
                                            className="text-error hover:text-error-600 transition-base touch-target"
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* How It Works Section */}
                        <div className="mt-12 space-y-6">
                            <h3 className="text-2xl font-heading font-semibold text-primary text-center mb-8">
                                Comment ça fonctionne ?
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="card text-center">
                                    <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-2xl font-heading font-bold text-primary">1</span>
                                    </div>
                                    <h4 className="font-heading font-semibold text-lg text-primary mb-2">Téléchargez</h4>
                                    <p className="text-sm text-text-secondary">
                                        Glissez-déposez votre vidéo MP4 ou sélectionnez-la depuis votre appareil
                                    </p>
                                </div>
                                <div className="card text-center">
                                    <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-2xl font-heading font-bold text-accent">2</span>
                                    </div>
                                    <h4 className="font-heading font-semibold text-lg text-primary mb-2">Traitez</h4>
                                    <p className="text-sm text-text-secondary">
                                        Notre IA analyse et supprime automatiquement les silences de votre vidéo
                                    </p>
                                </div>
                                <div className="card text-center">
                                    <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-2xl font-heading font-bold text-success">3</span>
                                    </div>
                                    <h4 className="font-heading font-semibold text-lg text-primary mb-2">Téléchargez</h4>
                                    <p className="text-sm text-text-secondary">
                                        Récupérez votre vidéo optimisée prête à être partagée ou publiée
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Right Ad Column */}
                    <aside className="hidden lg:block lg:col-span-2 space-y-6" id="rightAdColumn">
                        <div className="card bg-gradient-to-br from-secondary-50 to-accent-50 border-2 border-dashed border-secondary-200 min-h-[400px] flex flex-col items-center justify-center text-center p-6">
                            <i className="fas fa-rectangle-ad text-4xl text-secondary-300 mb-3"></i>
                            <p className="text-sm text-text-secondary font-caption">Espace Publicitaire</p>
                            <p className="text-xs text-text-tertiary mt-1">300 × 600</p>
                        </div>
                        <div className="card bg-gradient-to-br from-primary-50 to-accent-50 border-2 border-dashed border-primary-200 min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                            <i className="fas fa-ad text-3xl text-primary-300 mb-3"></i>
                            <p className="text-sm text-text-secondary font-caption">Publicité</p>
                            <p className="text-xs text-text-tertiary mt-1">300 × 250</p>
                        </div>
                    </aside>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-surface border-t border-border mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <h4 className="font-heading font-semibold text-primary mb-4">SilenceCut</h4>
                            <p className="text-sm text-text-secondary">
                                Optimisez vos vidéos en supprimant automatiquement les silences grâce à notre technologie IA.
                            </p>
                        </div>
                        <div>
                            <h5 className="font-semibold text-text-primary mb-4">Produit</h5>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">Fonctionnalités</a></li>
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">Tarifs</a></li>
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">API</a></li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-semibold text-text-primary mb-4">Entreprise</h5>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">À propos</a></li>
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">Blog</a></li>
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">Carrières</a></li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-semibold text-text-primary mb-4">Support</h5>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">Centre d'aide</a></li>
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">Contact</a></li>
                                <li><a href="#" className="text-sm text-text-secondary hover:text-primary transition-base">Confidentialité</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-text-secondary">© 2025 SilenceCut. Tous droits réservés.</p>
                        <div className="flex items-center gap-4">
                            <a href="#" className="text-text-secondary hover:text-primary transition-base" aria-label="Facebook">
                                <i className="fab fa-facebook text-lg"></i>
                            </a>
                            <a href="#" className="text-text-secondary hover:text-primary transition-base" aria-label="Twitter">
                                <i className="fab fa-twitter text-lg"></i>
                            </a>
                            <a href="#" className="text-text-secondary hover:text-primary transition-base" aria-label="Instagram">
                                <i className="fab fa-instagram text-lg"></i>
                            </a>
                            <a href="#" className="text-text-secondary hover:text-primary transition-base" aria-label="LinkedIn">
                                <i className="fab fa-linkedin text-lg"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
