import { apiClient } from './apiClient'
import { inventoryService } from './inventoryService'

export const workspaceService = {
  trash: (type, page = 1) => apiClient.get(`/v1/trash?type=${type}&page=${page}`),
  async restore(type, id) {
    const response = await apiClient.post(`/v1/trash/${type}/${id}/restore`)
    await inventoryService.refreshAfterWrite()
    return response
  },
  notifications: (page = 1) => apiClient.get(`/v1/notifications?page=${page}`),
  async readNotification(id) {
    const response = await apiClient.post(`/v1/notifications/${id}/read`)
    inventoryService.updateNotificationCount(response.unreadCount)
    return response
  },
  async readAllNotifications() {
    const response = await apiClient.post('/v1/notifications/read-all')
    inventoryService.updateNotificationCount(response.unreadCount)
    return response
  },
}
