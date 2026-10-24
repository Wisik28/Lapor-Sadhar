<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('admin_sessions')) {
            Schema::create('admin_sessions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('admin_id')->constrained('admin', 'admin_id')->cascadeOnDelete();
                $table->char('token_hash', 64)->unique();
                $table->timestamp('expires_at');
                $table->timestamps();
            });
        }
    }

    public function down(): void {}
};
