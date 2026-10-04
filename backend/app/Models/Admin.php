<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Admin extends Model
{
    use HasFactory;

    protected $table = 'admin';
    protected $primaryKey = 'admin_id';

    protected $fillable = [
        'nama_admin',
        'username',
        'password',
        'role',
    ];

    protected $hidden = [
        'password',
    ];
}
