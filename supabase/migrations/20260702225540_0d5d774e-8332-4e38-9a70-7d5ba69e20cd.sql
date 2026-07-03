
CREATE POLICY "own course-files objects read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "own course-files objects insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'course-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "own course-files objects update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'course-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "own course-files objects delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'course-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
