import axios from "axios";

export async function translatePost(postId, targetLanguage) {
  const response = await axios.post(`/api/translate/post/${postId}`, {
    target_language: targetLanguage,
  });
  return response.data;
}

export async function translateComment(commentId, targetLanguage) {
  const response = await axios.post(`/api/translate/comment/${commentId}`, {
    target_language: targetLanguage,
  });
  return response.data;
}

export async function getTranslationUsage() {
  const response = await axios.get("/api/translate/usage");
  return response.data.usage;
}
