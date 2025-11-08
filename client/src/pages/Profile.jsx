import { useState, useEffect } from "react";
import axios from "../api/axios";


export default function Profile() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  // fetching all users from the database
  const fetchUsers = async () => {
    try {
      // create a new endpoint to get all users
      const response = await axios.get("/api/auth/users");
      setUsers(response.data.users);
    } catch (err) {
      console.error("Error fetching users:", err);
      alert("Failed to load users");
    }
  };

  // so we use useEffect to prevent recursive calls due to useState like setUser...but if we don’t use useState, then no need to define it here
  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "" 
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    try {
      const response = await axios.put("/api/auth/update", {
        id: editingUser.id,
        name: form.name,
        email: form.email,
        password: form.password || undefined
      });
      
      alert("Update successful!");
      console.log("Updated user:", response.data.user);
      
      // Refresh the users list
      fetchUsers();
      // Reset form
      setEditingUser(null);
      setForm({ name: "", email: "", password: "" });
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      return;
    }
    
    try {
      await axios.delete("/api/auth/delete", {
        data: { id: userId }
      });
      alert("User deleted successfully!");
      
      // Refresh the users list
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setForm({ name: "", email: "", password: "" });
  };

  return (
    <div className="profile-container">
      <h2>User Management Dashboard</h2>
      <p>View, edit, and delete users from the database</p>

      {/* Edit Form */}
      {editingUser && (
        <div className="edit-form" style={{ 
          border: '2px solid #007bff', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          backgroundColor: '#f8f9fa'
        }}>
          <h3>Editing User: {editingUser.name}</h3>
          <form onSubmit={handleUpdate} className="auth-form">
            <input 
              name="name" 
              placeholder="Full name" 
              value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value})} 
              required
            />
            <input 
              name="email" 
              type="email" 
              placeholder="Email" 
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})} 
              required
            />
            <input 
              name="password" 
              type="password" 
              placeholder="New Password (leave blank to keep current)" 
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})} 
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update User"}
              </button>
              <button type="button" onClick={cancelEdit} style={{ backgroundColor: '#6c757d' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="users-table">
        <h3>Users in Database</h3>
        {users.length === 0 ? (
          <p>No users found in the database.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Role</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Created At</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{user.id}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{user.name}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{user.email}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{user.role}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                    {new Date(user.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                    <button 
                      onClick={() => handleEdit(user)}
                      style={{ 
                        marginRight: '10px', 
                        padding: '5px 10px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id)}
                      style={{ 
                        padding: '5px 10px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Refresh Button */}
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={fetchUsers}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh Users List
        </button>
      </div>
    </div>
  );
}