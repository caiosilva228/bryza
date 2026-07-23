'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  deleteProductImage,
  fetchProductImageLibrary,
  type ProductImageLibraryItem,
} from './actions';
import styles from './ProductImageLibrary.module.css';

interface ProductImageLibraryProps {
  currentImageUrl: string;
  onClose: () => void;
  onDelete: (deletedUrl: string) => void;
  onSelect: (imageUrl: string) => void;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export default function ProductImageLibrary({
  currentImageUrl,
  onClose,
  onDelete,
  onSelect,
}: ProductImageLibraryProps) {
  const [images, setImages] = useState<ProductImageLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError('');

    const result = await fetchProductImageLibrary();
    if (result.success) {
      setImages(result.data ?? []);
    } else {
      setError(result.error ?? 'Não foi possível carregar as imagens.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleDelete = async (image: ProductImageLibraryItem) => {
    const usageMessage =
      image.usedBy.length > 0
        ? ` Ela está sendo usada por ${image.usedBy.length} produto(s), que ficarão sem imagem.`
        : '';
    const confirmed = window.confirm(
      `Excluir esta imagem definitivamente da biblioteca?${usageMessage} Esta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    setDeletingName(image.name);
    const result = await deleteProductImage(image.name);

    if (result.success && result.deletedUrl) {
      setImages((current) => current.filter((item) => item.name !== image.name));
      onDelete(result.deletedUrl);
    } else {
      window.alert(result.error ?? 'Não foi possível excluir a imagem.');
    }

    setDeletingName(null);
  };

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-image-library-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="product-image-library-title">Biblioteca de imagens</h2>
            <p>Use uma imagem já cadastrada ou exclua arquivos que não são mais necessários.</p>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            onClick={onClose}
            aria-label="Fechar biblioteca"
            autoFocus
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </header>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.state}>
              <div>
                <span className="material-symbols-outlined animate-spin">sync</span>
                <p>Carregando imagens...</p>
              </div>
            </div>
          ) : error ? (
            <div className={styles.state}>
              <div>
                <span className="material-symbols-outlined">cloud_off</span>
                <p>{error}</p>
                <button className={styles.retryButton} type="button" onClick={loadImages}>
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : images.length === 0 ? (
            <div className={styles.state}>
              <div>
                <span className="material-symbols-outlined">photo_library</span>
                <p>Nenhuma imagem cadastrada na biblioteca.</p>
              </div>
            </div>
          ) : (
            <div className={styles.grid}>
              {images.map((image) => {
                const isSelected = image.publicUrl === currentImageUrl;
                const isDeleting = deletingName === image.name;

                return (
                  <article
                    className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                    key={image.name}
                  >
                    <div className={styles.imageWrap}>
                      <img src={image.publicUrl} alt={`Imagem ${image.name}`} />
                      {isSelected && <span className={styles.selectedBadge}>Selecionada</span>}
                      {image.usedBy.length > 0 && (
                        <span className={styles.usageBadge}>
                          Em uso por {image.usedBy.length}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardBody}>
                      <p className={styles.fileName} title={image.name}>{image.name}</p>
                      <p className={styles.meta}>
                        {formatFileSize(image.size)} · {formatDate(image.createdAt)}
                      </p>
                      <p className={styles.usedBy} title={image.usedBy.map((item) => item.name).join(', ')}>
                        {image.usedBy.length > 0
                          ? `Usada em: ${image.usedBy.map((item) => item.name).join(', ')}`
                          : 'Imagem ainda não vinculada a produtos.'}
                      </p>
                      <div className={styles.actions}>
                        <button
                          className={styles.useButton}
                          type="button"
                          disabled={isSelected || isDeleting}
                          onClick={() => {
                            onSelect(image.publicUrl);
                            onClose();
                          }}
                        >
                          {isSelected ? 'Imagem em uso' : 'Usar imagem'}
                        </button>
                        <button
                          className={styles.deleteButton}
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDelete(image)}
                          aria-label={`Excluir ${image.name}`}
                          title="Excluir da biblioteca"
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            {isDeleting ? 'sync' : 'delete'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
