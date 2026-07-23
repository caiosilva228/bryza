-- Product images are served from a public bucket, but management operations
-- must be restricted to active administrators.
DROP POLICY IF EXISTS "Authenticated Delete Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Product Images" ON storage.objects;

CREATE POLICY "Admins can list product images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.get_user_role() = 'admin'
);

CREATE POLICY "Admins can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.get_user_role() = 'admin'
);

CREATE POLICY "Admins can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.get_user_role() = 'admin'
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.get_user_role() = 'admin'
);

CREATE POLICY "Admins can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.get_user_role() = 'admin'
);
